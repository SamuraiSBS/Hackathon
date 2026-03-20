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

$attempt = $state['attempts'][$attemptIndex];

if (($attempt['status'] ?? '') !== 'blocked') {
    respond(['error' => 'Attempt is not blocked.'], 409);
}

$restoreStatus = (string) ($attempt['blockedFromStatus'] ?? 'registered');
$state['attempts'][$attemptIndex]['status'] = $restoreStatus !== '' ? $restoreStatus : 'registered';
unset(
    $state['attempts'][$attemptIndex]['blockedAt'],
    $state['attempts'][$attemptIndex]['blockedFromStatus']
);

save_state($state);

respond([
    'attempt' => $state['attempts'][$attemptIndex],
]);
