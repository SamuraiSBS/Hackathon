<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

require_post();
require_admin();

$payload = request_json();
$gameId = required_string($payload, 'gameId');

set_active_game_id($gameId);

respond([
    'activeGameId' => active_game_id(),
]);
