<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();

logout_admin();

respond([
    'authenticated' => false,
]);

