<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/telegram.php';

require_get();
require_stand_access();

respond(telegram_status_payload());
