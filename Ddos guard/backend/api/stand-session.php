<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

respond([
    'authenticated' => stand_is_authenticated(),
    'tokenConfigured' => stand_token_configured(),
    'authenticatedAt' => stand_authenticated_at(),
    'deactivatedAt' => stand_deactivated_at(),
    'activeGameId' => active_game_id(),
]);
