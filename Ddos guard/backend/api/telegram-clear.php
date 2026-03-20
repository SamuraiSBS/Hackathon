<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/telegram.php';

require_post();
require_stand_access();

clear_telegram_pending_profile();
clear_telegram_error();
clear_telegram_auth_flow();

respond([
    'ok' => true,
    'configured' => telegram_login_configured(),
]);
