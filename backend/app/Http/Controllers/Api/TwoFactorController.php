<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Two-factor authentication (TOTP).
 *
 * ENROLMENT IS TWO-STEP ON PURPOSE. `enable` only stores a secret; 2FA does not take effect
 * until `confirm` proves the authenticator app is producing codes this server accepts. A rep who
 * scans a QR badly, or whose phone clock is wrong, discovers it while still logged in instead of
 * at the next sign-in with no way back. Nothing here can lock someone out permanently: recovery
 * codes exist, and an admin can reset another user's 2FA.
 */
class TwoFactorController extends Controller
{
    /** Current user's 2FA state — drives the Security panel. */
    public function show(Request $request): JsonResponse
    {
        $u = $request->user();

        return response()->json([
            'enabled'          => $u->hasTwoFactor(),
            'pending'          => !$u->hasTwoFactor() && !empty($u->two_factor_secret),
            'recovery_codes_remaining' => count($u->two_factor_recovery_codes ?? []),
        ]);
    }

    /**
     * Step 1 — generate a secret and recovery codes. Returns them ONCE, in the clear, because
     * that is the only moment they can be shown; they are encrypted at rest and never re-served.
     */
    public function enable(Request $request): JsonResponse
    {
        $u = $request->user();
        if ($u->hasTwoFactor()) {
            return response()->json(['message' => 'Two-factor is already enabled. Disable it first to re-enrol.'], 409);
        }

        $secret = Totp::generateSecret();
        $codes = collect(range(1, 8))->map(fn () => Str::upper(Str::random(5).'-'.Str::random(5)))->all();

        $u->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => $codes,
            'two_factor_confirmed_at' => null,   // NOT live until confirm()
        ])->save();

        return response()->json([
            'secret' => $secret,
            'otpauth_url' => Totp::uri($secret, $u->email ?: $u->username, (string) config('organization.totp_issuer')),
            'recovery_codes' => $codes,
        ]);
    }

    /** Step 2 — verify a code from the app; only now does 2FA become live. */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);
        $u = $request->user();

        if (empty($u->two_factor_secret)) {
            return response()->json(['message' => 'Start the setup first.'], 409);
        }
        if (!Totp::verify($u->two_factor_secret, $request->input('code'))) {
            return response()->json(['message' => 'That code is not valid. Check your phone\'s clock and try the current code.'], 422);
        }

        $u->forceFill(['two_factor_confirmed_at' => now()])->save();
        ActivityLog::record($u->id, 'two_factor_enabled', "{$u->username} enabled two-factor authentication");

        return response()->json(['enabled' => true]);
    }

    /**
     * Turn 2FA off. Requires the account password: a walk-up attacker on an unlocked laptop
     * should not be able to strip the second factor with one click.
     */
    public function disable(Request $request): JsonResponse
    {
        $request->validate(['password' => 'required|string']);
        $u = $request->user();

        if (!Hash::check($request->input('password'), $u->password)) {
            return response()->json(['message' => 'Password is incorrect.'], 422);
        }

        $u->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
        ActivityLog::record($u->id, 'two_factor_disabled', "{$u->username} disabled two-factor authentication");

        return response()->json(['enabled' => false]);
    }

    /**
     * Admin escape hatch — clears another user's 2FA when their phone is lost or wiped.
     * Without this, a lost phone plus lost recovery codes is a permanently dead account.
     */
    public function reset(Request $request, User $user): JsonResponse
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        ActivityLog::record($request->user()->id, 'two_factor_reset', "reset two-factor for {$user->username}");

        return response()->json(['ok' => true]);
    }
}
