<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Routes that must never run inside an impersonated session.
 *
 * "View as" exists to SEE what a team member sees. Credential surgery is a different act: while
 * impersonating, an admin must not be able to change that person's password, strip or re-enrol
 * their 2FA, or start a further impersonation. Those would let an admin quietly take permanent
 * ownership of someone's account, and would land in the audit log under the victim's name.
 *
 * Admins keep all of these powers in their OWN session — this only closes the borrowed one.
 */
class BlockWhileImpersonating
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();

        if ($token && $token->name === 'impersonation') {
            return response()->json([
                'message' => 'Not available while viewing as another user. Return to your own account first.',
            ], 403);
        }

        return $next($request);
    }
}
