<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_admin();

request_json();
logout_stand();

respond([
    'authenticated' => false,
    'deactivatedAt' => stand_deactivated_at(),
]);
