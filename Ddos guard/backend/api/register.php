<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_stand_access();

$payload = request_json();
$state = load_state();

$firstName = trim((string) ($payload['firstName'] ?? ''));
$lastName = trim((string) ($payload['lastName'] ?? ''));
$phone = trim((string) ($payload['phone'] ?? ''));
$telegram = trim((string) ($payload['telegram'] ?? ''));
$telegramId = trim((string) ($payload['telegramId'] ?? ''));
$telegramPhotoUrl = trim((string) ($payload['telegramPhotoUrl'] ?? ''));
$source = trim((string) ($payload['source'] ?? ''));
$assignedGameId = active_game_id();
$sessionId = create_id('lead');

if ($source !== 'telegram' && $source !== 'manual') {
    $source = $telegramId !== '' || $telegramPhotoUrl !== '' ? 'telegram' : 'manual';
}

if ($source === 'telegram') {
    if ($firstName === '' && $lastName === '') {
        if ($telegram !== '') {
            $firstName = ltrim($telegram, '@');
        } elseif ($telegramId !== '') {
            $firstName = 'Telegram Player';
        } else {
            respond(['error' => 'Telegram profile is incomplete.'], 422);
        }
    }
} else {
    if ($firstName === '') {
        respond(['error' => 'Field "firstName" is required.'], 422);
    }

    if ($lastName === '') {
        respond(['error' => 'Field "lastName" is required.'], 422);
    }

    if ($phone === '') {
        respond(['error' => 'Field "phone" is required.'], 422);
    }

    $telegram = '';
    $telegramId = '';
    $telegramPhotoUrl = '';
}

array_unshift(
    $state['attempts'],
    [
        'sessionId' => $sessionId,
        'firstName' => $firstName,
        'lastName' => $lastName,
        'phone' => $phone,
        'telegram' => $telegram,
        'telegramId' => $telegramId,
        'telegramPhotoUrl' => $telegramPhotoUrl,
        'source' => $source,
        'assignedGameId' => $assignedGameId,
        'consent' => true,
        'createdAt' => date(DATE_ATOM),
        'status' => 'registered',
        'plays' => [],
    ]
);

save_state($state);

respond([
    'sessionId' => $sessionId,
    'player' => [
        'firstName' => $firstName,
        'lastName' => $lastName,
        'phone' => $phone,
        'telegram' => $telegram,
        'telegramId' => $telegramId,
        'telegramPhotoUrl' => $telegramPhotoUrl,
        'source' => $source,
        'activeGameId' => $assignedGameId,
        'playedGameIds' => [],
        'gamesAvailable' => count(available_game_ids()),
    ],
]);
