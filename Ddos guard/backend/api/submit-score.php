<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_stand_access();

$payload = request_json();
$state = load_state();

$sessionId = required_string($payload, 'sessionId');
$requestedGameId = trim((string) ($payload['gameId'] ?? ''));
$gameTitle = trim((string) ($payload['gameTitle'] ?? ''));
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

$attempt = $state['attempts'][$attemptIndex];
$gameId = attempt_assigned_game_id($attempt);

if ($requestedGameId !== '' && $requestedGameId !== $gameId) {
    respond([
        'error' => 'Game mismatch. This session is assigned to another mode.',
        'assignedGameId' => $gameId,
    ], 409);
}

if ($gameTitle === '') {
    $gameTitle = $gameId;
}

$plays = attempt_plays($attempt);
if (count($plays) > 0) {
    respond([
        'error' => 'Game attempt already completed.',
        'assignedGameId' => $gameId,
    ], 409);
}

$finishedAt = date(DATE_ATOM);
$plays[] = [
    'gameId' => $gameId,
    'gameTitle' => $gameTitle,
    'result' => $result,
    'reason' => $reason,
    'score' => $score,
    'durationSeconds' => $durationSeconds,
    'finishedAt' => $finishedAt,
];

$state['attempts'][$attemptIndex]['plays'] = $plays;
$state['attempts'][$attemptIndex]['finishedAt'] = $finishedAt;
$state['attempts'][$attemptIndex]['gameId'] = $gameId;
$state['attempts'][$attemptIndex]['gameTitle'] = $gameTitle;
$state['attempts'][$attemptIndex]['result'] = $result;
$state['attempts'][$attemptIndex]['reason'] = $reason;
$state['attempts'][$attemptIndex]['score'] = $score;
$state['attempts'][$attemptIndex]['durationSeconds'] = $durationSeconds;
$state['attempts'][$attemptIndex]['assignedGameId'] = $gameId;
$state['attempts'][$attemptIndex]['status'] = 'completed';

save_state($state);

$attempt = $state['attempts'][$attemptIndex];
$attempt['playedGameIds'] = played_game_ids($attempt);
$attempt['gamesCompleted'] = games_played_count($attempt);
$attempt['gamesAvailable'] = count(available_game_ids());
$attempt['allGamesCompleted'] = true;
$attempt['assignedGameId'] = attempt_assigned_game_id($attempt);

respond([
    'attempt' => $attempt,
]);
