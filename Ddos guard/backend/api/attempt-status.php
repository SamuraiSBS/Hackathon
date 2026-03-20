<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_get();
require_stand_access();

$sessionId = trim((string) ($_GET['sessionId'] ?? ''));

if ($sessionId === '') {
    respond(['error' => 'Query parameter "sessionId" is required.'], 422);
}

$state = load_state();
$attemptIndex = find_attempt_index($state['attempts'], $sessionId);

if ($attemptIndex === null) {
    respond(['error' => 'Attempt not found.'], 404);
}

$attempt = $state['attempts'][$attemptIndex];

respond([
    'sessionId' => $attempt['sessionId'] ?? '',
    'playerName' => player_name($attempt),
    'status' => $attempt['status'] ?? 'registered',
    'blocked' => ($attempt['status'] ?? '') === 'blocked',
    'blockedAt' => $attempt['blockedAt'] ?? null,
]);
