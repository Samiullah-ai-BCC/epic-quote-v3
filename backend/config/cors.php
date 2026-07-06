<?php

// API CORS. Auth is Bearer-token (not cookies), so supports_credentials stays false
// and a cross-origin site still can't read a victim's token. Even so, we replace the
// framework default of '*' with an allow-list. Set CORS_ALLOWED_ORIGINS (comma-separated)
// in production to the SPA's real origin(s); the defaults cover local dev + the known hosts.
$origins = array_filter(array_map('trim', explode(',', (string) env(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:5174,http://localhost:3000,http://127.0.0.1:5173,https://estimator.epiccraftings.com'
))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $origins,
    // allow any Render preview/prod subdomain for this app without hardcoding the hash
    'allowed_origins_patterns' => ['#^https://epic-quote-v3[\w-]*\.onrender\.com$#'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
