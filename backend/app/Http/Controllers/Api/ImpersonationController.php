<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin "view as" — see the app exactly as a team member sees it, without their password.
 *
 * The impersonation session is a SEPARATE token named 'impersonation'. That name is the marker
 * the guard middleware reads. It deliberately does not use Sanctum abilities: ordinary tokens are
 * minted with the '*' wildcard, and `tokenCan('impersonation')` returns TRUE for a wildcard token
 * — every normal session would have been treated as an impersonated one.
 *
 * Every start and stop is written to the activity log naming the real admin, so actions taken
 * while impersonating can always be traced back to the person who actually took them.
 */
class ImpersonationController extends Controller
{
    public function start(Request $request, User $user): JsonResponse
    {
        $admin = $request->user();

        // No impersonation-inside-impersonation: the audit trail could no longer say who acted.
        if ($this->isImpersonating($request)) {
            return response()->json(['message' => 'Already viewing as another user. Return to your own account first.'], 409);
        }
        if ($user->id === $admin->id) {
            return response()->json(['message' => 'You are already signed in as yourself.'], 422);
        }

        $token = $user->createToken('impersonation')->plainTextToken;
        ActivityLog::record($admin->id, 'impersonate_start', "{$admin->username} started viewing as {$user->username}");

        return response()->json([
            'token' => $token,
            'user'  => $user->toApi(),
            'impersonator' => ['id' => $admin->id, 'username' => $admin->username, 'full_name' => $admin->full_name],
        ]);
    }

    /** End the session by revoking the impersonation token; the client restores its own. */
    public function stop(Request $request): JsonResponse
    {
        $user = $request->user();
        $token = $user->currentAccessToken();

        if (!$token || $token->name !== 'impersonation') {
            return response()->json(['message' => 'Not currently viewing as another user.'], 422);
        }

        ActivityLog::record($user->id, 'impersonate_stop', "stopped viewing as {$user->username}");
        $token->delete();

        return response()->json(['ok' => true]);
    }

    private function isImpersonating(Request $request): bool
    {
        $t = $request->user()?->currentAccessToken();

        return $t !== null && $t->name === 'impersonation';
    }
}
