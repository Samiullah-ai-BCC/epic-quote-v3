<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Require confirmed 2FA on every real user session. */
class RequireTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        // The enrolled administrator already completed 2FA. This borrowed, audited token is not
        // a password login by the target user and must keep the existing view-as flow working.
        if ($token?->name === 'impersonation') {
            return $next($request);
        }

        if (!$user?->hasTwoFactor()) {
            return response()->json([
                'message' => 'Two-factor authentication setup is required. Please sign in again to complete it.',
            ], 401);
        }

        return $next($request);
    }
}
