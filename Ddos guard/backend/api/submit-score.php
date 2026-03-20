<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_stand_access();

$payload = request_json();
$state = load_state();

$sessionId = required_string($payload, 'sessionId');
$gameId = required_string($payload, 'gameId');
$gameTitle = required_string($payload, 'gameTitle');
$result = required_string($payload, 'result');
$reason = trim((string) ($payload['reason'] ?? ''));
$score = (int) ($payload['score'] ?? 0);
$durationSeconds = (int) ($payload['durationSeconds'] ?? 0);

$attemptIndex = find_attempt_index($state['attempts'], $sessionId);

if ($attemptIndex === null) {
    respond(['error' => 'Attempt not found.'], 404);
}

if (($state['attempts'][$attemptIndex]['status'] ?? '') === 'blocked') {
    respond(['error' => 'Attempt blocked by administrator.'], 403);
}

if (($state['attempts'][$attemptIndex]['status'] ?? '') === 'completed') {
    respond(['error' => 'Attempt already completed.'], 409);
}

if (($state['attempts'][$attemptIndex]['status'] ?? '') !== 'registered') {
    respond(['error' => 'Attempt is not available for score submission.'], 409);
}

$state['attempts'][$attemptIndex]['status'] = 'completed';
$state['attempts'][$attemptIndex]['finishedAt'] = date(DATE_ATOM);
$state['attempts'][$attemptIndex]['gameId'] = $gameId;
$state['attempts'][$attemptIndex]['gameTitle'] = $gameTitle;
$state['attempts'][$attemptIndex]['result'] = $result;
$state['attempts'][$attemptIndex]['reason'] = $reason;
$state['attempts'][$attemptIndex]['score'] = $score;
$state['attempts'][$attemptIndex]['durationSeconds'] = $durationSeconds;

save_state($state);

respond([
    'attempt' => $state['attempts'][$attemptIndex],
]);
