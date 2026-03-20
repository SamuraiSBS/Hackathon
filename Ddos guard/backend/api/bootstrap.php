<?php

declare(strict_types=1);

configure_session_cookie();
session_name('ddos_guard_admin');
session_start();

send_common_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DATA_FILE = __DIR__ . '/../data/state.json';

function now_iso(): string
{
    return date(DATE_ATOM);
}

function default_app_state(): array
{
    return [
        'stand' => default_stand_state(),
        'attempts' => seed_attempts(),
    ];
}

function configure_session_cookie(): void
{
    $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function send_common_headers(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    $allowedOrigin = allowed_origin();
    if ($allowedOrigin !== null) {
        header(sprintf('Access-Control-Allow-Origin: %s', $allowedOrigin));
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
}

function app_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $config = [];
    $localConfigPath = dirname(__DIR__) . '/config.local.php';

    if (file_exists($localConfigPath)) {
        $loaded = require $localConfigPath;
        if (is_array($loaded)) {
            $config = $loaded;
        }
    }

    $config['admin_password'] = getenv('DDOS_GUARD_ADMIN_PASSWORD') ?: ($config['admin_password'] ?? '');
    $config['admin_password_hash'] = getenv('DDOS_GUARD_ADMIN_PASSWORD_HASH') ?: ($config['admin_password_hash'] ?? '');
    $config['stand_token'] = getenv('DDOS_GUARD_STAND_TOKEN') ?: ($config['stand_token'] ?? '');
    $config['stand_token_hash'] = getenv('DDOS_GUARD_STAND_TOKEN_HASH') ?: ($config['stand_token_hash'] ?? '');
    $config['allowed_origin'] = getenv('DDOS_GUARD_ALLOWED_ORIGIN') ?: ($config['allowed_origin'] ?? '');
    $config['public_app_url'] = getenv('DDOS_GUARD_PUBLIC_APP_URL') ?: ($config['public_app_url'] ?? '');
    $config['telegram_client_id'] = getenv('DDOS_GUARD_TELEGRAM_CLIENT_ID') ?: ($config['telegram_client_id'] ?? '');
    $config['telegram_client_secret'] = getenv('DDOS_GUARD_TELEGRAM_CLIENT_SECRET') ?: ($config['telegram_client_secret'] ?? '');
    $config['telegram_redirect_uri'] = getenv('DDOS_GUARD_TELEGRAM_REDIRECT_URI') ?: ($config['telegram_redirect_uri'] ?? '');

    return $config;
}

function configured_allowed_origins(): array
{
    $configuredOrigins = app_config()['allowed_origin'] ?? '';

    $allowedOrigins = is_array($configuredOrigins)
        ? $configuredOrigins
        : explode(',', (string) $configuredOrigins);

    $allowedOrigins = array_map(
        static fn(mixed $origin): string => trim((string) $origin),
        $allowedOrigins
    );
    $allowedOrigins = array_values(array_filter(
        $allowedOrigins,
        static fn(string $origin): bool => $origin !== ''
    ));

    return array_values(array_unique($allowedOrigins));
}

function first_allowed_origin(): string
{
    return configured_allowed_origins()[0] ?? '';
}

function allowed_origin(): ?string
{
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowedOrigins = configured_allowed_origins();

    if ($requestOrigin === '' || count($allowedOrigins) === 0) {
        return null;
    }

    foreach ($allowedOrigins as $origin) {
        if (hash_equals($origin, $requestOrigin)) {
            return $requestOrigin;
        }
    }

    return null;
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        respond(['error' => 'Invalid JSON payload.'], 400);
    }

    return $decoded;
}

function admin_password_configured(): bool
{
    $config = app_config();
    return ($config['admin_password'] ?? '') !== '' || ($config['admin_password_hash'] ?? '') !== '';
}

function stand_token_configured(): bool
{
    $config = app_config();
    return ($config['stand_token'] ?? '') !== '' || ($config['stand_token_hash'] ?? '') !== '';
}

function verify_admin_password(string $password): bool
{
    $config = app_config();
    $plainPassword = (string) ($config['admin_password'] ?? '');
    $passwordHash = (string) ($config['admin_password_hash'] ?? '');

    if ($plainPassword !== '') {
        return hash_equals($plainPassword, $password);
    }

    if ($passwordHash !== '') {
        return password_verify($password, $passwordHash);
    }

    return false;
}

function verify_stand_token(string $token): bool
{
    $config = app_config();
    $plainToken = (string) ($config['stand_token'] ?? '');
    $tokenHash = (string) ($config['stand_token_hash'] ?? '');

    if ($plainToken !== '') {
        return hash_equals($plainToken, $token);
    }

    if ($tokenHash !== '') {
        return password_verify($token, $tokenHash);
    }

    return false;
}

function admin_is_authenticated(): bool
{
    return (bool) ($_SESSION['admin_authenticated'] ?? false);
}

function stand_is_authenticated(): bool
{
    $state = load_state();
    return (bool) (($state['stand']['authenticated'] ?? false) === true);
}

function stand_authenticated_at(): ?string
{
    $state = load_state();
    $value = $state['stand']['authenticatedAt'] ?? null;

    return is_string($value) && $value !== '' ? $value : null;
}

function stand_deactivated_at(): ?string
{
    $state = load_state();
    $value = $state['stand']['deactivatedAt'] ?? null;

    return is_string($value) && $value !== '' ? $value : null;
}

function default_stand_state(): array
{
    return [
        'authenticated' => false,
        'authenticatedAt' => null,
        'deactivatedAt' => null,
    ];
}

function migrate_legacy_stand_state(array $decoded): array
{
    if (isset($decoded['stand']) && is_array($decoded['stand'])) {
        return array_merge(default_stand_state(), $decoded['stand']);
    }

    if (!isset($decoded['stands']) || !is_array($decoded['stands'])) {
        return default_stand_state();
    }

    $activeAuthenticatedAt = null;
    $latestDeactivatedAt = null;

    foreach ($decoded['stands'] as $record) {
        if (!is_array($record)) {
            continue;
        }

        $authenticatedAt = trim((string) ($record['authenticatedAt'] ?? ''));
        $deactivatedAt = trim((string) ($record['deactivatedAt'] ?? ''));

        if (($record['authenticated'] ?? false) === true) {
            if ($activeAuthenticatedAt === null || strtotime($authenticatedAt) > strtotime($activeAuthenticatedAt)) {
                $activeAuthenticatedAt = $authenticatedAt !== '' ? $authenticatedAt : now_iso();
            }
        }

        if ($deactivatedAt !== '' && ($latestDeactivatedAt === null || strtotime($deactivatedAt) > strtotime($latestDeactivatedAt))) {
            $latestDeactivatedAt = $deactivatedAt;
        }
    }

    if ($activeAuthenticatedAt !== null) {
        return [
            'authenticated' => true,
            'authenticatedAt' => $activeAuthenticatedAt,
            'deactivatedAt' => null,
        ];
    }

    return [
        'authenticated' => false,
        'authenticatedAt' => null,
        'deactivatedAt' => $latestDeactivatedAt,
    ];
}

function require_admin(): void
{
    if (!admin_is_authenticated()) {
        respond(['error' => 'Unauthorized.'], 401);
    }
}

function require_stand_access(): void
{
    if (!stand_is_authenticated()) {
        respond(['error' => 'Stand access required.'], 401);
    }
}

function login_admin(string $password): void
{
    if (!admin_password_configured()) {
        respond(['error' => 'Admin password is not configured.'], 503);
    }

    if (!verify_admin_password($password)) {
        respond(['error' => 'Invalid password.'], 401);
    }

    session_regenerate_id(true);
    $_SESSION['admin_authenticated'] = true;
    $_SESSION['admin_authenticated_at'] = now_iso();
}

function login_stand(string $token): void
{
    if (!stand_token_configured()) {
        respond(['error' => 'Stand token is not configured.'], 503);
    }

    if (!verify_stand_token($token)) {
        respond(['error' => 'Invalid stand token.'], 401);
    }

    $state = load_state();
    $state['stand']['authenticated'] = true;
    $state['stand']['authenticatedAt'] = now_iso();
    $state['stand']['deactivatedAt'] = null;
    save_state($state);
}

function logout_admin(): void
{
    unset($_SESSION['admin_authenticated'], $_SESSION['admin_authenticated_at']);
    session_regenerate_id(true);
}

function logout_stand(): void
{
    $state = load_state();
    $state['stand']['authenticated'] = false;
    $state['stand']['deactivatedAt'] = now_iso();
    save_state($state);
}

function ensure_data_file(): void
{
    if (file_exists(DATA_FILE)) {
        return;
    }

    if (!is_dir(dirname(DATA_FILE))) {
        mkdir(dirname(DATA_FILE), 0777, true);
    }

    save_state(default_app_state());
}

function load_state(): array
{
    ensure_data_file();

    $raw = file_get_contents(DATA_FILE);
    $decoded = json_decode($raw ?: '', true);

    if (!is_array($decoded)) {
        $decoded = default_app_state();
        save_state($decoded);
    }

    $decoded['stand'] = migrate_legacy_stand_state($decoded);
    unset($decoded['stands']);

    if (!isset($decoded['attempts']) || !is_array($decoded['attempts'])) {
        $decoded['attempts'] = seed_attempts();
    }

    return $decoded;
}

function save_state(array $state): void
{
    $encoded = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    if ($encoded === false) {
        respond(['error' => 'Unable to serialize state.'], 500);
    }

    $temporaryFile = DATA_FILE . '.tmp';
    file_put_contents($temporaryFile, $encoded, LOCK_EX);
    rename($temporaryFile, DATA_FILE);
}

function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['error' => 'Method not allowed.'], 405);
    }
}

function require_get(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        respond(['error' => 'Method not allowed.'], 405);
    }
}

function required_string(array $payload, string $field): string
{
    $value = trim((string) ($payload[$field] ?? ''));

    if ($value === '') {
        respond(['error' => sprintf('Field "%s" is required.', $field)], 422);
    }

    return $value;
}

function create_id(string $prefix): string
{
    return sprintf('%s-%d-%s', $prefix, time(), bin2hex(random_bytes(3)));
}

function find_attempt_index(array $attempts, string $sessionId): ?int
{
    foreach ($attempts as $index => $attempt) {
        if (($attempt['sessionId'] ?? '') === $sessionId) {
            return $index;
        }
    }

    return null;
}

function player_name(array $attempt): string
{
    $name = trim(($attempt['firstName'] ?? '') . ' ' . ($attempt['lastName'] ?? ''));

    if ($name !== '') {
        return $name;
    }

    if (($attempt['telegram'] ?? '') !== '') {
        return (string) $attempt['telegram'];
    }

    return 'Игрок';
}

function attempt_is_blocked(array $attempt): bool
{
    return ($attempt['status'] ?? '') === 'blocked' || !empty($attempt['blockedAt']);
}

function leaderboard_from_attempts(array $attempts): array
{
    $completed = array_values(array_filter(
        $attempts,
        static fn(array $attempt): bool => ($attempt['status'] ?? '') === 'completed' && !attempt_is_blocked($attempt)
    ));

    usort(
        $completed,
        static function (array $left, array $right): int {
            $scoreDiff = (int) ($right['score'] ?? 0) <=> (int) ($left['score'] ?? 0);

            if ($scoreDiff !== 0) {
                return $scoreDiff;
            }

            return strtotime((string) ($left['finishedAt'] ?? '')) <=> strtotime((string) ($right['finishedAt'] ?? ''));
        }
    );

    $leaders = [];
    foreach (array_slice($completed, 0, 12) as $index => $attempt) {
        $leaders[] = [
            'rank' => $index + 1,
            'sessionId' => $attempt['sessionId'],
            'playerName' => player_name($attempt),
            'score' => (int) ($attempt['score'] ?? 0),
            'result' => $attempt['result'] ?? 'defeat',
            'gameId' => $attempt['gameId'] ?? '',
            'gameTitle' => $attempt['gameTitle'] ?? '',
            'finishedAt' => $attempt['finishedAt'] ?? null,
        ];
    }

    return $leaders;
}

function summary_from_attempts(array $attempts): array
{
    $completed = array_values(array_filter(
        $attempts,
        static fn(array $attempt): bool => ($attempt['status'] ?? '') === 'completed' && !attempt_is_blocked($attempt)
    ));

    $victories = count(array_filter(
        $completed,
        static fn(array $attempt): bool => ($attempt['result'] ?? '') === 'victory'
    ));

    $telegramLeads = count(array_filter(
        $attempts,
        static fn(array $attempt): bool => ($attempt['source'] ?? '') === 'telegram'
    ));

    $bestScore = 0;
    foreach ($completed as $attempt) {
        $bestScore = max($bestScore, (int) ($attempt['score'] ?? 0));
    }

    return [
        'totalLeads' => count($attempts),
        'completedRuns' => count($completed),
        'victories' => $victories,
        'bestScore' => $bestScore,
        'telegramLeads' => $telegramLeads,
        'manualLeads' => count($attempts) - $telegramLeads,
    ];
}

function recent_leads_from_attempts(array $attempts): array
{
    usort(
        $attempts,
        static fn(array $left, array $right): int => strtotime((string) ($right['createdAt'] ?? '')) <=> strtotime((string) ($left['createdAt'] ?? ''))
    );

    $recent = [];
    foreach (array_slice($attempts, 0, 12) as $attempt) {
        $recent[] = [
            'sessionId' => $attempt['sessionId'],
            'playerName' => player_name($attempt),
            'phone' => $attempt['phone'] ?? '',
            'telegram' => $attempt['telegram'] ?? '',
            'source' => $attempt['source'] ?? 'manual',
            'status' => $attempt['status'] ?? 'registered',
            'blockedAt' => $attempt['blockedAt'] ?? null,
            'result' => $attempt['result'] ?? null,
            'gameTitle' => $attempt['gameTitle'] ?? '',
            'score' => (int) ($attempt['score'] ?? 0),
            'createdAt' => $attempt['createdAt'] ?? null,
            'finishedAt' => $attempt['finishedAt'] ?? null,
        ];
    }

    return $recent;
}

function seed_attempts(): array
{
    return [
        [
            'sessionId' => 'seed-anna',
            'firstName' => 'Анна',
            'lastName' => 'Ковалева',
            'phone' => '+7 (921) 111-20-30',
            'telegram' => '@annak',
            'source' => 'telegram',
            'consent' => true,
            'createdAt' => date(DATE_ATOM, time() - 2700),
            'finishedAt' => date(DATE_ATOM, time() - 2600),
            'gameId' => 'edge-glide',
            'gameTitle' => 'Edge Glide',
            'result' => 'victory',
            'status' => 'completed',
            'score' => 1840,
            'durationSeconds' => 70,
        ],
        [
            'sessionId' => 'seed-ivan',
            'firstName' => 'Иван',
            'lastName' => 'Сергеев',
            'phone' => '+7 (903) 222-11-00',
            'telegram' => '',
            'source' => 'manual',
            'consent' => true,
            'createdAt' => date(DATE_ATOM, time() - 1800),
            'finishedAt' => date(DATE_ATOM, time() - 1700),
            'gameId' => 'bot-slicer',
            'gameTitle' => 'Bot Slicer',
            'result' => 'victory',
            'status' => 'completed',
            'score' => 2360,
            'durationSeconds' => 60,
        ],
        [
            'sessionId' => 'seed-polina',
            'firstName' => 'Полина',
            'lastName' => 'Миронова',
            'phone' => '+7 (926) 555-44-10',
            'telegram' => '@pmironova',
            'source' => 'telegram',
            'consent' => true,
            'createdAt' => date(DATE_ATOM, time() - 1000),
            'finishedAt' => date(DATE_ATOM, time() - 920),
            'gameId' => 'infra-stack',
            'gameTitle' => 'Infra Stack',
            'result' => 'victory',
            'status' => 'completed',
            'score' => 1480,
            'durationSeconds' => 55,
        ],
        [
            'sessionId' => 'seed-maxim',
            'firstName' => 'Максим',
            'lastName' => 'Орлов',
            'phone' => '+7 (999) 444-66-55',
            'telegram' => '',
            'source' => 'manual',
            'consent' => true,
            'createdAt' => date(DATE_ATOM, time() - 480),
            'finishedAt' => date(DATE_ATOM, time() - 420),
            'gameId' => 'packet-catcher',
            'gameTitle' => 'Packet Catcher',
            'result' => 'defeat',
            'status' => 'completed',
            'score' => 760,
            'durationSeconds' => 49,
        ],
    ];
}
