<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        health: '/up',
        then: function () {
            // Serve public-disk uploads (artwork, customer files, logos) directly — no
            // storage:link symlink needed, so it works on Windows and in Docker alike.
            // Flysystem blocks path traversal, so '../' escapes resolve to a 404.
            Route::get('/storage/{path}', function (string $path) {
                $disk = Storage::disk('public');
                // CORS '*' on BOTH the hit and the miss so the SPA (a different origin in
                // production) can fetch these via XHR (pdf.js rasterize / the drawing HEAD-check)
                // and html2canvas can read them crossOrigin for PDF export. Returning the 404
                // ourselves — instead of abort(404) — keeps the CORS header on the miss, so a
                // missing file reads as a clean 404 in the browser, not an opaque CORS error.
                $cors = [
                    'Access-Control-Allow-Origin'  => '*',
                    'Access-Control-Allow-Methods' => 'GET, HEAD, OPTIONS',
                ];
                if (! $disk->exists($path)) {
                    return response()->json(['message' => 'File not found.'], 404, $cors);
                }
                return response()->file($disk->path($path), $cors);
            })->where('path', '.*');
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'readonly.guard' => \App\Http\Middleware\BlockViewerWrites::class,
        ]);

        // baseline security headers on every API response (+ strip X-Powered-By)
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);

        // Pure Bearer-token auth (#130) — NOT cookie/CSRF SPA mode.
        // statefulApi() would force CSRF on requests from SANCTUM_STATEFUL_DOMAINS
        // (e.g. the vite dev origin), causing 419 on token logins.

        // UNAUTHENTICATED MUST MEAN 401, NEVER 500. Laravel's Authenticate middleware redirects
        // guests to the route named 'login' unless the request expects JSON — and this app is
        // API-only, so that route does not exist: the redirect threw RouteNotFoundException
        // ("Route [login] not defined"), a 500, which sails straight past the
        // AuthenticationException -> 401 handler below. The SPA sets Accept: application/json and
        // so was served a correct 401; anything that does not (a browser address-bar hit, an
        // uptime check, a proxy that strips the header) got a 500 and read as "the API is down"
        // instead of "you are not logged in" — which is exactly how a routine auth failure got
        // mistaken for a broken database. Returning null means "do not redirect", so the guest
        // path always raises AuthenticationException and always renders as 401 JSON.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Request $request) {
            return response()->json(['message' => 'Forbidden.'], 403);
        });

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors'  => $e->errors(),
            ], 422);
        });

        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\NotFoundHttpException $e, Request $request) {
            return response()->json(['message' => 'Not found.'], 404);
        });
    })->create();
