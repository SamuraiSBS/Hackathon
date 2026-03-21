<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_admin();

$state = load_state();

respond([
    'summary' => summary_from_attempts($state['attempts']),
    'leaderboard' => leaderboard_from_attempts($state['attempts']),
    'recentLeads' => recent_leads_from_attempts($state['attempts']),
    'stand' => [
        'activeGameId' => (string) ($state['stand']['activeGameId'] ?? active_game_id()),
    ],
]);
