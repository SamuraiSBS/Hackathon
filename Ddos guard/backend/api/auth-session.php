<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

respond([
    'authenticated' => admin_is_authenticated(),
    'passwordConfigured' => admin_password_configured(),
    'authenticatedAt' => $_SESSION['admin_authenticated_at'] ?? null,
]);

