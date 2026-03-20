<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();

$payload = request_json();
$password = trim((string) ($payload['password'] ?? ''));

if ($password === '') {
    respond(['error' => 'Password is required.'], 422);
}

login_admin($password);

respond([
    'authenticated' => true,
    'authenticatedAt' => $_SESSION['admin_authenticated_at'] ?? null,
]);

