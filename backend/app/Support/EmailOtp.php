<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use App\Mail\TwoFactorCodeMail;
use Illuminate\Support\Facades\Mail;

/**
 * Sign-in codes delivered by EMAIL, for accounts whose second factor is not an authenticator app.
 *
 * The security properties are the ones a TOTP gives you for free and an emailed code does not, so
 * each is written out here rather than assumed:
 *   HASHED AT REST   — the users table is the first thing read in a database leak; a live code
 *                      sitting in plaintext beside the account it protects hands over the second
 *                      factor with the first.
 *   SHORT LIFE       — ten minutes. A code in an inbox outlives the session it was minted for;
 *                      the window is the whole reason email is a weaker channel than TOTP.
 *   SINGLE USE       — cleared the moment it verifies, so a forwarded or shoulder-surfed message
 *                      cannot be replayed.
 *   ATTEMPT CAPPED   — six digits is 10^6. Five wrong guesses burn the code and force a new one,
 *                      which turns an offline-feeling brute force into "make me send another
 *                      email", on top of the route's own throttle.
 *   NEVER ECHOED     — the code is not in any API response, only in the message. An endpoint that
 *                      returns the code it just sent is not a second factor at all.
 */
class EmailOtp
{
    public const TTL_MINUTES = 10;
    public const MAX_ATTEMPTS = 5;

    /** Mint a code, store only its hash, and send it. Returns the masked address it went to. */
    public static function send(User $user): string
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $user->forceFill([
            'two_factor_email_code' => Hash::make($code),
            'two_factor_email_expires_at' => now()->addMinutes(self::TTL_MINUTES),
            'two_factor_email_attempts' => 0,
        ])->save();

        try {
            Mail::to($user->email)->send(new TwoFactorCodeMail(
                code: $code,
                name: $user->full_name ?: $user->username,
                minutes: self::TTL_MINUTES,
            ));
        } catch (\Throwable $e) {
            // NEVER let a mail failure surface as a login error containing infrastructure detail,
            // and never abort the challenge: the account still has its authenticator and recovery
            // codes, so a broken mailbox degrades the sign-in rather than locking the person out.
            Log::error('2FA email failed for user '.$user->id.': '.$e->getMessage());
        }

        ActivityLog::record($user->id, 'two_factor_email_sent', "{$user->username} was emailed a sign-in code");

        return self::maskEmail((string) $user->email);
    }

    /**
     * Check a submitted code. Returns true ONLY for a live, unexpired, correctly-guessed code,
     * and burns it on success.
     */
    public static function verify(User $user, string $code): bool
    {
        $hash = (string) $user->two_factor_email_code;
        if ($hash === '' || $user->two_factor_email_expires_at === null) {
            return false;
        }
        if ($user->two_factor_email_expires_at->isPast()) {
            self::clear($user);
            return false;
        }
        if ($user->two_factor_email_attempts >= self::MAX_ATTEMPTS) {
            self::clear($user);
            return false;
        }

        if (!Hash::check(trim($code), $hash)) {
            $user->forceFill(['two_factor_email_attempts' => $user->two_factor_email_attempts + 1])->save();
            return false;
        }

        self::clear($user);   // single use
        return true;
    }

    public static function clear(User $user): void
    {
        $user->forceFill([
            'two_factor_email_code' => null,
            'two_factor_email_expires_at' => null,
            'two_factor_email_attempts' => 0,
        ])->save();
    }

    /** r***@epiccraftings.com — enough for the person to recognise their own inbox, no more. */
    public static function maskEmail(string $email): string
    {
        if (!str_contains($email, '@')) return '';
        [$local, $domain] = explode('@', $email, 2);
        $head = mb_substr($local, 0, 1);
        return $head.str_repeat('*', max(3, mb_strlen($local) - 1)).'@'.$domain;
    }
}
