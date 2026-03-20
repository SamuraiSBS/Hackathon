<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/telegram.php';

require_get();

clear_telegram_error();

try {
    telegram_complete_login($_GET);
} catch (Throwable $exception) {
    clear_telegram_pending_profile();
    set_telegram_error($exception->getMessage());
}

telegram_redirect_to_app();
