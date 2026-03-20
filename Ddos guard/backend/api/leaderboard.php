<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$state = load_state();

respond([
    'leaderboard' => leaderboard_from_attempts($state['attempts']),
]);

