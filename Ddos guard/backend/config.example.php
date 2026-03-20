<?php

declare(strict_types=1);

return [
    'admin_password' => 'ddos-guard',

    'stand_token' => '10853005bc4a741a4ccfd9d6ee9948fb43c605587f973862',

    'allowed_origin' => [
        'http://localhost:5173',
        'http://192.168.0.50:5174',
    ],

    'public_app_url' => 'http://192.168.0.50:5174/',

    'telegram_client_id' => '',
    'telegram_client_secret' => '',
    'telegram_redirect_uri' => 'http://192.168.0.50:8080/telegram-callback.php',
];
