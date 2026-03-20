<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_admin();

$payload = request_json();
$token = trim((string) ($payload['token'] ?? ''));

if ($token === '') {
    respond(['error' => 'Stand token is required.'], 422);
}

login_stand($token);

respond([
    'authenticated' => true,
    'authenticatedAt' => stand_authenticated_at(),
]);
