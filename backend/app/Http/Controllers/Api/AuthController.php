<?php

namespace App\Http\Controllers\Api;

use App\Constants\AppConstants;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\EmailOtp;
use App\Support\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // V1 parity: username stored lowercase + trimmed. The login form has always SAID
        // "Email or username", but only the username column was ever matched — anyone typing
        // their email got "Login failed" no matter how correct the password was ("changed a
        // user's creds and now can't even log in": the reset was fine, the email lookup didn't
        // exist). Username wins on a collision; email is the fallback, case-insensitive.
        $username = strtolower(trim($request->username));
        $user = User::where('username', $username)->first()
            ?? User::whereRaw('LOWER(email) = ?', [$username])->orderBy('id')->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['Invalid username or password'],
            ]);
        }

        // 2FA: the password alone earns a CHALLENGE, not a session. The challenge is a short-lived
        // encrypted payload rather than a real token, so a correct password never yields anything
        // that can call the API before the second factor is proven. Accounts without 2FA are
        // untouched by this branch and log in exactly as before.
        if ($user->hasTwoFactor()) {
            // EMAIL-CHANNEL ACCOUNTS get their code now, as part of earning the challenge — the
            // password has already been proven at this point, so this cannot be used by a stranger
            // to spray mail at someone's inbox. Accounts on the authenticator keep the exact flow
            // they had: no code is minted, nothing is sent, the branch below is not entered.
            $sentTo = $user->usesEmailTwoFactor() ? EmailOtp::send($user) : null;

            return response()->json(array_filter([
                'two_factor_required' => true,
                'challenge' => $this->challengeFor($user, 'login'),
                'channel' => $user->usesEmailTwoFactor() ? 'email' : 'totp',
                // Masked, so the screen can say WHERE the code went without printing a full
                // address to whoever is sitting at that machine.
                'sent_to' => $sentTo,
            ], fn ($v) => $v !== null));
        }

        // Mandatory first-login enrolment. Tokens minted under the old optional policy must die
        // now, or they would become usable again as soon as this account confirms its factor.
        $user->tokens()->delete();
        $secret = Totp::generateSecret();
        $codes = collect(range(1, 8))->map(fn () => Str::upper(Str::random(5).'-'.Str::random(5)))->all();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => $codes,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json([
            'two_factor_setup_required' => true,
            'challenge' => $this->challengeFor($user, 'setup'),
            'secret' => $secret,
            'otpauth_url' => Totp::uri($secret, $user->email ?: $user->username, (string) config('organization.totp_issuer')),
            'recovery_codes' => $codes,
        ]);
    }

    /**
     * Second step of a 2FA login: exchange the challenge + a TOTP (or recovery) code for a token.
     * Throttled at the route, because this endpoint is the one an attacker with a stolen password
     * would brute-force — six digits is only 10^6, and unlimited attempts make that trivial.
     */
    public function twoFactorChallenge(Request $request): JsonResponse
    {
        $request->validate([
            'challenge' => 'required|string',
            'code'      => 'required|string',
        ]);

        try {
            $payload = decrypt($request->input('challenge'));
        } catch (\Throwable) {
            return response()->json(['message' => 'This sign-in attempt is no longer valid. Please log in again.'], 422);
        }
        if (!is_array($payload) || ($payload['purpose'] ?? null) !== 'login' || ($payload['exp'] ?? 0) < now()->timestamp) {
            return response()->json(['message' => 'This sign-in attempt has expired. Please log in again.'], 422);
        }

        $user = User::find($payload['uid'] ?? null);
        if (!$user || !$user->hasTwoFactor()) {
            return response()->json(['message' => 'This sign-in attempt is no longer valid. Please log in again.'], 422);
        }

        $code = trim((string) $request->input('code'));

        // The emailed code is checked first for accounts on that channel. The authenticator and the
        // recovery codes below REMAIN VALID for them, deliberately: mail is the one factor here
        // that can fail for reasons the person cannot see or fix — a bounced address, an outage, a
        // spam filter — and this is the login path, where the cost of being wrong is a locked-out
        // rep on a Monday morning. Both are genuine second factors owned by the same account.
        if ($user->usesEmailTwoFactor() && EmailOtp::verify($user, $code)) {
            return response()->json($this->issueSession($user));
        }

        if (Totp::verify((string) $user->two_factor_secret, $code)) {
            return response()->json($this->issueSession($user));
        }

        // Recovery codes are single-use: match case-insensitively, then burn it.
        $codes = $user->two_factor_recovery_codes ?? [];
        $idx = array_search(strtoupper($code), array_map('strtoupper', $codes), true);
        if ($idx !== false) {
            unset($codes[$idx]);
            $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();
            ActivityLog::record($user->id, 'two_factor_recovery_used', "{$user->username} signed in with a recovery code (".count($codes).' left)');

            return response()->json($this->issueSession($user));
        }

        return response()->json(['message' => 'That code is not valid.'], 422);
    }

    /**
     * POST /api/two-factor/resend — send another code to the same account.
     *
     * The CHALLENGE is the authorisation, not a username: it is an encrypted, expiring payload
     * minted only after a correct password, so this endpoint cannot be used to make the system
     * email a stranger. Throttled at the route on top of that.
     */
    public function resendTwoFactorCode(Request $request): JsonResponse
    {
        $request->validate(['challenge' => 'required|string']);

        try {
            $payload = decrypt($request->input('challenge'));
        } catch (\Throwable) {
            return response()->json(['message' => 'This sign-in attempt is no longer valid. Please log in again.'], 422);
        }
        if (!is_array($payload) || ($payload['purpose'] ?? null) !== 'login' || ($payload['exp'] ?? 0) < now()->timestamp) {
            return response()->json(['message' => 'This sign-in attempt has expired. Please log in again.'], 422);
        }

        $user = User::find($payload['uid'] ?? null);
        // Same answer whether the account is missing, has no 2FA, or is on the authenticator: this
        // endpoint must not become a way to ask the server which accounts receive email codes.
        if (!$user || !$user->hasTwoFactor() || !$user->usesEmailTwoFactor()) {
            return response()->json(['message' => 'This sign-in attempt is no longer valid. Please log in again.'], 422);
        }

        return response()->json(['sent_to' => EmailOtp::send($user)]);
    }

    /** Confirm mandatory first-login setup, then mint this account's first valid session. */
    public function confirmTwoFactorSetup(Request $request): JsonResponse
    {
        $request->validate([
            'challenge' => 'required|string',
            'code' => 'required|string',
        ]);

        try {
            $payload = decrypt($request->input('challenge'));
        } catch (\Throwable) {
            return response()->json(['message' => 'This setup attempt is no longer valid. Please sign in again.'], 422);
        }

        if (!is_array($payload) || ($payload['purpose'] ?? null) !== 'setup' || ($payload['exp'] ?? 0) < now()->timestamp) {
            return response()->json(['message' => 'This setup attempt has expired. Please sign in again.'], 422);
        }

        $user = User::find($payload['uid'] ?? null);
        if (!$user || $user->hasTwoFactor() || empty($user->two_factor_secret)) {
            return response()->json(['message' => 'This setup attempt is no longer valid. Please sign in again.'], 422);
        }

        if (!Totp::verify((string) $user->two_factor_secret, (string) $request->input('code'))) {
            return response()->json(['message' => 'That code is not valid. Check your phone\'s clock and try the current code.'], 422);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();
        ActivityLog::record($user->id, 'two_factor_enabled', "{$user->username} completed mandatory two-factor setup");

        return response()->json($this->issueSession($user));
    }

    private function challengeFor(User $user, string $purpose): string
    {
        return encrypt([
            'uid' => $user->id,
            'purpose' => $purpose,
            'exp' => now()->addMinutes(5)->timestamp,
        ]);
    }

    /** Stamp the login and mint the API token — the one place a session is created. */
    private function issueSession(User $user): array
    {
        $user->forceFill(['last_login' => now()])->save();
        ActivityLog::record($user->id, 'login', "{$user->username} logged in");

        return [
            'token' => $user->createToken('api-token')->plainTextToken,
            'user'  => $user->toApi(),
        ];
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        ActivityLog::record($user->id, 'logout', "{$user->username} logged out");
        $user->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        // `impersonating` lets the client rebuild the "viewing as" banner after a page refresh,
        // instead of trusting a flag it stashed in localStorage.
        return response()->json([
            'user' => $request->user()->toApi(),
            'impersonating' => $request->user()->currentAccessToken()?->name === 'impersonation',
        ]);
    }

    // V1 GET /api/constants
    public function constants(): JsonResponse
    {
        return response()->json([
            'statuses'      => \App\Models\Setting::statusOptions(),
            'sales_reps'    => AppConstants::SALES_REPS,
            'quote_sources' => AppConstants::QUOTE_SOURCES,
            'roles'         => AppConstants::ROLES,
            'sign_types'    => AppConstants::SIGN_TYPE_NAMES,
            // everyone on the team — feeds the "Assigned to" dropdown (quotes can be
            // assigned to any user, not just the preset sales reps)
            'team'          => \App\Models\User::orderBy('full_name')->pluck('full_name'),
        ]);
    }
}
