<?php

declare(strict_types=1);

const TELEGRAM_OIDC_ISSUER = 'https://oauth.telegram.org';
const TELEGRAM_OIDC_AUTH_URL = 'https://oauth.telegram.org/auth';
const TELEGRAM_OIDC_TOKEN_URL = 'https://oauth.telegram.org/token';
const TELEGRAM_OIDC_JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json';
const TELEGRAM_JWKS_CACHE_TTL = 3600;

function telegram_login_configured(): bool
{
    $config = app_config();

    return trim((string) ($config['telegram_client_id'] ?? '')) !== ''
        && trim((string) ($config['telegram_client_secret'] ?? '')) !== ''
        && trim((string) ($config['telegram_redirect_uri'] ?? '')) !== '';
}

function telegram_client_id(): string
{
    return trim((string) (app_config()['telegram_client_id'] ?? ''));
}

function telegram_client_secret(): string
{
    return trim((string) (app_config()['telegram_client_secret'] ?? ''));
}

function telegram_redirect_uri(): string
{
    return trim((string) (app_config()['telegram_redirect_uri'] ?? ''));
}

function telegram_public_app_url(): string
{
    $config = app_config();
    $publicAppUrl = trim((string) ($config['public_app_url'] ?? ''));

    if ($publicAppUrl !== '') {
        return $publicAppUrl;
    }

    return first_allowed_origin();
}

function telegram_status_payload(): array
{
    return [
        'configured' => telegram_login_configured(),
        'profile' => telegram_pending_profile(),
        'error' => telegram_error_message(),
    ];
}

function telegram_pending_profile(): ?array
{
    $profile = $_SESSION['telegram_pending_profile'] ?? null;

    if (!is_array($profile)) {
        return null;
    }

    return [
        'telegramId' => (string) ($profile['telegramId'] ?? ''),
        'firstName' => (string) ($profile['firstName'] ?? ''),
        'lastName' => (string) ($profile['lastName'] ?? ''),
        'phone' => (string) ($profile['phone'] ?? ''),
        'telegram' => (string) ($profile['telegram'] ?? ''),
        'photoUrl' => (string) ($profile['photoUrl'] ?? ''),
        'authenticatedAt' => (string) ($profile['authenticatedAt'] ?? ''),
        'source' => 'telegram',
    ];
}

function store_telegram_pending_profile(array $profile): void
{
    $_SESSION['telegram_pending_profile'] = [
        'telegramId' => (string) ($profile['telegramId'] ?? ''),
        'firstName' => (string) ($profile['firstName'] ?? ''),
        'lastName' => (string) ($profile['lastName'] ?? ''),
        'phone' => (string) ($profile['phone'] ?? ''),
        'telegram' => (string) ($profile['telegram'] ?? ''),
        'photoUrl' => (string) ($profile['photoUrl'] ?? ''),
        'authenticatedAt' => (string) ($profile['authenticatedAt'] ?? date(DATE_ATOM)),
    ];
}

function clear_telegram_pending_profile(): void
{
    unset($_SESSION['telegram_pending_profile']);
}

function telegram_error_message(): string
{
    return trim((string) ($_SESSION['telegram_auth_error'] ?? ''));
}

function set_telegram_error(string $message): void
{
    $_SESSION['telegram_auth_error'] = trim($message);
}

function clear_telegram_error(): void
{
    unset($_SESSION['telegram_auth_error']);
}

function clear_telegram_auth_flow(): void
{
    unset(
        $_SESSION['telegram_oidc_state'],
        $_SESSION['telegram_oidc_code_verifier'],
        $_SESSION['telegram_oidc_started_at']
    );
}

function telegram_redirect_to_app(): void
{
    $target = telegram_public_app_url();

    if ($target === '') {
        respond(['error' => 'Public app URL is not configured.'], 500);
    }

    header(sprintf('Location: %s', $target), true, 302);
    exit;
}

function telegram_begin_login(): void
{
    if (!stand_is_authenticated()) {
        set_telegram_error('Стендовая сессия истекла. Разблокируйте стенд повторно.');
        telegram_redirect_to_app();
    }

    if (!telegram_login_configured()) {
        set_telegram_error('Telegram Login не настроен на backend.');
        telegram_redirect_to_app();
    }

    clear_telegram_pending_profile();
    clear_telegram_error();
    clear_telegram_auth_flow();

    $state = telegram_random_string(24);
    $verifier = telegram_random_string(32);

    $_SESSION['telegram_oidc_state'] = $state;
    $_SESSION['telegram_oidc_code_verifier'] = $verifier;
    $_SESSION['telegram_oidc_started_at'] = time();

    $query = http_build_query(
        [
            'client_id' => telegram_client_id(),
            'redirect_uri' => telegram_redirect_uri(),
            'response_type' => 'code',
            'scope' => 'openid profile phone',
            'state' => $state,
            'code_challenge' => telegram_code_challenge($verifier),
            'code_challenge_method' => 'S256',
        ],
        '',
        '&',
        PHP_QUERY_RFC3986
    );

    header(sprintf('Location: %s?%s', TELEGRAM_OIDC_AUTH_URL, $query), true, 302);
    exit;
}

function telegram_complete_login(array $query): void
{
    if (!telegram_login_configured()) {
        throw new RuntimeException('Telegram Login не настроен.');
    }

    $error = trim((string) ($query['error'] ?? ''));
    $errorDescription = trim((string) ($query['error_description'] ?? ''));

    if ($error !== '') {
        throw new RuntimeException(telegram_callback_error_message($error, $errorDescription));
    }

    $returnedState = trim((string) ($query['state'] ?? ''));
    $authorizationCode = trim((string) ($query['code'] ?? ''));
    $expectedState = trim((string) ($_SESSION['telegram_oidc_state'] ?? ''));
    $codeVerifier = trim((string) ($_SESSION['telegram_oidc_code_verifier'] ?? ''));

    clear_telegram_auth_flow();

    if ($returnedState === '' || $expectedState === '' || !hash_equals($expectedState, $returnedState)) {
        throw new RuntimeException('Не удалось подтвердить состояние Telegram-авторизации.');
    }

    if ($authorizationCode === '' || $codeVerifier === '') {
        throw new RuntimeException('Telegram не вернул код авторизации.');
    }

    $tokens = telegram_exchange_code($authorizationCode, $codeVerifier);
    $idToken = trim((string) ($tokens['id_token'] ?? ''));

    if ($idToken === '') {
        throw new RuntimeException('Telegram не вернул ID token.');
    }

    $claims = telegram_validate_id_token($idToken);

    session_regenerate_id(true);
    store_telegram_pending_profile(telegram_profile_from_claims($claims));
    clear_telegram_error();
}

function telegram_exchange_code(string $authorizationCode, string $codeVerifier): array
{
    return telegram_http_json(
        TELEGRAM_OIDC_TOKEN_URL,
        [
            'method' => 'POST',
            'headers' => [
                'Authorization: Basic ' . base64_encode(telegram_client_id() . ':' . telegram_client_secret()),
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
            ],
            'body' => http_build_query(
                [
                    'grant_type' => 'authorization_code',
                    'code' => $authorizationCode,
                    'redirect_uri' => telegram_redirect_uri(),
                    'client_id' => telegram_client_id(),
                    'code_verifier' => $codeVerifier,
                ],
                '',
                '&',
                PHP_QUERY_RFC3986
            ),
        ]
    );
}

function telegram_validate_id_token(string $idToken): array
{
    $parts = explode('.', $idToken);

    if (count($parts) !== 3) {
        throw new RuntimeException('Telegram вернул некорректный ID token.');
    }

    [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

    $header = json_decode(telegram_base64url_decode($encodedHeader), true);
    $payload = json_decode(telegram_base64url_decode($encodedPayload), true);
    $signature = telegram_base64url_decode($encodedSignature);

    if (!is_array($header) || !is_array($payload) || $signature === '') {
        throw new RuntimeException('Не удалось разобрать ID token от Telegram.');
    }

    if (($header['alg'] ?? '') !== 'RS256') {
        throw new RuntimeException('Telegram вернул неподдерживаемый алгоритм подписи.');
    }

    $jwk = telegram_find_jwk((string) ($header['kid'] ?? ''));
    $publicKey = telegram_jwk_to_public_key($jwk);
    $verified = openssl_verify($encodedHeader . '.' . $encodedPayload, $signature, $publicKey, OPENSSL_ALGO_SHA256);

    if ($verified !== 1) {
        throw new RuntimeException('Не удалось проверить подпись Telegram ID token.');
    }

    if (($payload['iss'] ?? '') !== TELEGRAM_OIDC_ISSUER) {
        throw new RuntimeException('Telegram вернул токен от неверного issuer.');
    }

    if (!telegram_audience_matches($payload['aud'] ?? null, telegram_client_id())) {
        throw new RuntimeException('Telegram вернул токен для другого client_id.');
    }

    $now = time();
    $expiresAt = (int) ($payload['exp'] ?? 0);
    $issuedAt = (int) ($payload['iat'] ?? 0);

    if ($expiresAt !== 0 && $expiresAt < ($now - 30)) {
        throw new RuntimeException('Telegram ID token уже истёк.');
    }

    if ($issuedAt !== 0 && $issuedAt > ($now + 60)) {
        throw new RuntimeException('Telegram ID token имеет некорректный timestamp.');
    }

    return $payload;
}

function telegram_profile_from_claims(array $claims): array
{
    [$firstName, $lastName] = telegram_split_name((string) ($claims['name'] ?? ''));
    $username = trim((string) ($claims['preferred_username'] ?? ''));

    return [
        'telegramId' => (string) ($claims['id'] ?? $claims['sub'] ?? ''),
        'firstName' => $firstName,
        'lastName' => $lastName,
        'phone' => trim((string) ($claims['phone_number'] ?? '')),
        'telegram' => $username === '' ? '' : '@' . ltrim($username, '@'),
        'photoUrl' => trim((string) ($claims['picture'] ?? '')),
        'authenticatedAt' => date(DATE_ATOM),
        'source' => 'telegram',
    ];
}

function telegram_split_name(string $fullName): array
{
    $normalized = preg_replace('/\s+/u', ' ', trim($fullName)) ?? '';

    if ($normalized === '') {
        return ['', ''];
    }

    $parts = explode(' ', $normalized);
    $firstName = array_shift($parts) ?: '';
    $lastName = trim(implode(' ', $parts));

    return [$firstName, $lastName];
}

function telegram_callback_error_message(string $error, string $description = ''): string
{
    if ($error === 'access_denied') {
        return 'Пользователь отменил вход через Telegram.';
    }

    if ($description !== '') {
        return sprintf('Telegram вернул ошибку: %s.', $description);
    }

    return sprintf('Telegram вернул ошибку: %s.', $error);
}

function telegram_find_jwk(string $keyId): array
{
    $jwks = telegram_jwks();

    if ($keyId !== '') {
        foreach ($jwks as $jwk) {
            if (($jwk['kid'] ?? '') === $keyId) {
                return $jwk;
            }
        }
    }

    if (count($jwks) === 1) {
        return $jwks[0];
    }

    throw new RuntimeException('Не удалось подобрать публичный ключ Telegram.');
}

function telegram_jwks(): array
{
    static $cachedKeys = null;

    if (is_array($cachedKeys)) {
        return $cachedKeys;
    }

    $cacheFile = sys_get_temp_dir() . '/ddos-guard-telegram-jwks.json';

    if (is_file($cacheFile) && (filemtime($cacheFile) ?: 0) >= (time() - TELEGRAM_JWKS_CACHE_TTL)) {
        $cachedPayload = json_decode((string) file_get_contents($cacheFile), true);
        if (is_array($cachedPayload) && isset($cachedPayload['keys']) && is_array($cachedPayload['keys'])) {
            $cachedKeys = $cachedPayload['keys'];
            return $cachedKeys;
        }
    }

    $jwks = telegram_http_json(
        TELEGRAM_OIDC_JWKS_URL,
        [
            'method' => 'GET',
            'headers' => ['Accept: application/json'],
        ]
    );

    if (!isset($jwks['keys']) || !is_array($jwks['keys'])) {
        throw new RuntimeException('Telegram не вернул JWKS для проверки токена.');
    }

    @file_put_contents($cacheFile, json_encode($jwks, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);

    $cachedKeys = $jwks['keys'];
    return $cachedKeys;
}

function telegram_jwk_to_public_key(array $jwk): string
{
    if (($jwk['kty'] ?? '') !== 'RSA' || !isset($jwk['n'], $jwk['e'])) {
        throw new RuntimeException('Telegram вернул неподдерживаемый формат публичного ключа.');
    }

    $modulus = telegram_base64url_decode((string) $jwk['n']);
    $exponent = telegram_base64url_decode((string) $jwk['e']);

    $rsaPublicKey = telegram_asn1_sequence(
        telegram_asn1_integer($modulus) .
        telegram_asn1_integer($exponent)
    );

    $algorithmIdentifier = telegram_asn1_sequence(
        "\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01" . "\x05\x00"
    );

    $subjectPublicKeyInfo = telegram_asn1_sequence(
        $algorithmIdentifier . telegram_asn1_bit_string($rsaPublicKey)
    );

    return "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($subjectPublicKeyInfo), 64, "\n")
        . "-----END PUBLIC KEY-----\n";
}

function telegram_asn1_sequence(string $value): string
{
    return "\x30" . telegram_asn1_length(strlen($value)) . $value;
}

function telegram_asn1_integer(string $value): string
{
    if ($value === '') {
        $value = "\x00";
    }

    if ((ord($value[0]) & 0x80) !== 0) {
        $value = "\x00" . $value;
    }

    return "\x02" . telegram_asn1_length(strlen($value)) . $value;
}

function telegram_asn1_bit_string(string $value): string
{
    return "\x03" . telegram_asn1_length(strlen($value) + 1) . "\x00" . $value;
}

function telegram_asn1_length(int $length): string
{
    if ($length < 0x80) {
        return chr($length);
    }

    $encoded = '';
    while ($length > 0) {
        $encoded = chr($length & 0xff) . $encoded;
        $length >>= 8;
    }

    return chr(0x80 | strlen($encoded)) . $encoded;
}

function telegram_audience_matches($audienceClaim, string $expectedAudience): bool
{
    if (is_array($audienceClaim)) {
        foreach ($audienceClaim as $audienceValue) {
            if ((string) $audienceValue === $expectedAudience) {
                return true;
            }
        }

        return false;
    }

    return (string) $audienceClaim === $expectedAudience;
}

function telegram_http_json(string $url, array $options): array
{
    $response = telegram_http_request(
        $url,
        (string) ($options['method'] ?? 'GET'),
        (array) ($options['headers'] ?? []),
        isset($options['body']) ? (string) $options['body'] : null
    );

    $decoded = json_decode($response['body'], true);

    if (!is_array($decoded)) {
        throw new RuntimeException(sprintf('Telegram endpoint %s вернул не-JSON ответ.', $url));
    }

    if ($response['status'] < 200 || $response['status'] >= 300) {
        $error = trim((string) ($decoded['error_description'] ?? $decoded['error'] ?? ''));
        if ($error === '') {
            $error = sprintf('HTTP %d', $response['status']);
        }

        throw new RuntimeException(sprintf('Telegram endpoint %s вернул ошибку: %s.', $url, $error));
    }

    return $decoded;
}

function telegram_http_request(string $url, string $method, array $headers = [], ?string $body = null): array
{
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt($handle, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($handle, CURLOPT_CUSTOMREQUEST, strtoupper($method));
        curl_setopt($handle, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($handle, CURLOPT_TIMEOUT, 10);
        curl_setopt($handle, CURLOPT_FOLLOWLOCATION, true);

        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $rawBody = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);

        if ($rawBody === false) {
            $message = curl_error($handle);
            curl_close($handle);
            throw new RuntimeException(sprintf('Не удалось выполнить запрос к Telegram: %s.', $message));
        }

        curl_close($handle);

        return [
            'status' => $status,
            'body' => $rawBody,
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => strtoupper($method),
            'header' => implode("\r\n", $headers),
            'content' => $body ?? '',
            'ignore_errors' => true,
            'timeout' => 10,
        ],
    ]);

    $rawBody = file_get_contents($url, false, $context);

    if ($rawBody === false) {
        throw new RuntimeException('Не удалось выполнить запрос к Telegram.');
    }

    $statusLine = $http_response_header[0] ?? '';
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);

    return [
        'status' => isset($matches[1]) ? (int) $matches[1] : 0,
        'body' => $rawBody,
    ];
}

function telegram_random_string(int $bytes): string
{
    return telegram_base64url_encode(random_bytes($bytes));
}

function telegram_code_challenge(string $verifier): string
{
    return telegram_base64url_encode(hash('sha256', $verifier, true));
}

function telegram_base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function telegram_base64url_decode(string $value): string
{
    $padding = strlen($value) % 4;

    if ($padding > 0) {
        $value .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode(strtr($value, '-_', '+/'), true);

    if ($decoded === false) {
        throw new RuntimeException('Не удалось декодировать base64url payload Telegram.');
    }

    return $decoded;
}
