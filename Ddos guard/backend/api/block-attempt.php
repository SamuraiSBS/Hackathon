<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_admin();

$payload = request_json();
$state = load_state();
$sessionId = required_string($payload, 'sessionId');

$attemptIndex = find_attempt_index($state['attempts'], $sessionId);

if ($attemptIndex === null) {
    respond(['error' => 'Attempt not found.'], 404);
}

$previousStatus = (string) ($state['attempts'][$attemptIndex]['status'] ?? 'registered');
$state['attempts'][$attemptIndex]['status'] = 'blocked';
$state['attempts'][$attemptIndex]['blockedAt'] = date(DATE_ATOM);
$state['attempts'][$attemptIndex]['blockedFromStatus'] = $previousStatus;

save_state($state);

respond([
    'attempt' => $state['attempts'][$attemptIndex],
]);
