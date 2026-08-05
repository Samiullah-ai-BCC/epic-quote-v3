<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Choose how an account receives its sign-in code: an authenticator app, or email.
 *
 * A COMMAND, not a hardcoded username in the login path. "Rod gets email codes" written into an
 * if-statement is a condition nobody revisits until it is wrong, and the place it would be wrong
 * is the login screen. Here the decision is data, reversible with the same command, and the login
 * code only ever asks the account what it wants.
 *
 * Usage: php artisan users:two-factor-channel rod email [--dry-run]
 *        php artisan users:two-factor-channel rod totp
 */
class SetTwoFactorChannel extends Command
{
    protected $signature = 'users:two-factor-channel
        {user : username or email of the account}
        {channel : totp or email}
        {--dry-run : report what WOULD change and write nothing}';

    protected $description = 'Send an account\'s 2FA code by email instead of an authenticator app (or back again)';

    public function handle(): int
    {
        $channel = strtolower(trim((string) $this->argument('channel')));
        if (!in_array($channel, [User::TWO_FACTOR_TOTP, User::TWO_FACTOR_EMAIL], true)) {
            $this->error("Channel must be '".User::TWO_FACTOR_TOTP."' or '".User::TWO_FACTOR_EMAIL."'.");
            return self::FAILURE;
        }

        $key = strtolower(trim((string) $this->argument('user')));
        // Same resolution order as the login controller, so this can never configure a different
        // row than the one that actually signs in under that identifier.
        $user = User::where('username', $key)->first()
            ?? User::whereRaw('LOWER(email) = ?', [$key])->orderBy('id')->first();

        if (!$user) {
            $this->error("No account matches '{$key}'.");
            return self::FAILURE;
        }

        // An email channel with no address to send to is a locked door: the person would be asked
        // for a code that nothing can deliver. Refuse it here rather than at 8am on a Monday.
        if ($channel === User::TWO_FACTOR_EMAIL && trim((string) $user->email) === '') {
            $this->error("{$user->username} has no email address on file — set one before switching the channel.");
            return self::FAILURE;
        }

        $current = $user->two_factor_channel ?: User::TWO_FACTOR_TOTP;
        $this->line("Account id={$user->id} ({$user->username}, {$user->email})");
        if ($current === $channel) {
            $this->info("Already on '{$channel}' — nothing to change.");
            return self::SUCCESS;
        }
        $this->line("channel: {$current} -> {$channel}");

        if ($this->option('dry-run')) {
            $this->info('dry run — nothing written');
            return self::SUCCESS;
        }

        $user->forceFill(['two_factor_channel' => $channel])->save();
        // The authenticator secret and the recovery codes are deliberately LEFT IN PLACE. They stay
        // valid, which is what makes a mail outage a nuisance instead of a lockout, and it means
        // switching back is this command again rather than a re-enrolment.
        ActivityLog::record($user->id, 'two_factor_channel_changed',
            "{$user->username}'s sign-in code channel changed from {$current} to {$channel}");

        $this->info("{$user->username} now receives sign-in codes by "
            .($channel === User::TWO_FACTOR_EMAIL ? "email ({$user->email})" : 'authenticator app'));

        return self::SUCCESS;
    }
}
