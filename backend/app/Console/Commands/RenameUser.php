<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\User;
use App\Rules\AllowedEmailDomain;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Re-identify an existing account (username and/or email) without touching its password,
 * role, or history. Idempotent and --dry-run-able, per the data-change rule.
 *
 * Used to retire the seeded `test@123.com` placeholder admin in favour of a real company
 * address. The new email goes through the SAME domain rule the API enforces, so this command
 * cannot quietly create the one account that would fail its own validation.
 */
class RenameUser extends Command
{
    protected $signature = 'users:rename
        {from : current username (or email) of the account}
        {--username= : new username — this is what the person types to sign in}
        {--email= : new email address}
        {--full-name= : new display name}
        {--dry-run : report what WOULD change and exit without writing}';

    protected $description = 'Rename an account (username / email / display name), idempotently';

    public function handle(): int
    {
        $from = strtolower(trim((string) $this->argument('from')));
        // Same resolution order as the login controller, so this can never rename a different
        // row than the one that actually signs in under that identifier.
        $user = User::where('username', $from)->first()
            ?? User::whereRaw('LOWER(email) = ?', [$from])->orderBy('id')->first();

        if (!$user) {
            $this->error("No account matches '{$from}'.");
            return self::FAILURE;
        }

        $newUsername = $this->option('username') !== null ? strtolower(trim((string) $this->option('username'))) : null;
        $newEmail    = $this->option('email') !== null ? trim((string) $this->option('email')) : null;
        $newName     = $this->option('full-name') !== null ? trim((string) $this->option('full-name')) : null;

        if ($newEmail !== null && $newEmail !== '') {
            $v = Validator::make(['email' => $newEmail], ['email' => ['email', 'max:120', new AllowedEmailDomain()]]);
            if ($v->fails()) {
                $this->error('Refusing: '.implode(' ', $v->errors()->all()));
                return self::FAILURE;
            }
        }
        if ($newUsername !== null && $newUsername !== '' && $newUsername !== $user->username
            && User::where('username', $newUsername)->exists()) {
            $this->error("Username '{$newUsername}' is already taken.");
            return self::FAILURE;
        }

        $changes = [];
        foreach ([['username', $newUsername], ['email', $newEmail], ['full_name', $newName]] as [$field, $val]) {
            if ($val !== null && (string) $val !== (string) ($user->{$field} ?? '')) {
                $changes[$field] = [(string) ($user->{$field} ?? ''), (string) $val];
            }
        }

        $this->line("Account id={$user->id} (username={$user->username}, role={$user->role})");
        if ($changes === []) {
            $this->info('Already in the requested state — nothing to change.');
            return self::SUCCESS;
        }
        foreach ($changes as $f => [$was, $now]) {
            $this->line(sprintf('  %-10s %s -> %s', $f, $was === '' ? '(blank)' : $was, $now));
        }

        if ($this->option('dry-run')) {
            $this->warn('--dry-run: nothing written.');
            return self::SUCCESS;
        }

        foreach ($changes as $f => [, $now]) {
            $user->{$f} = $now;
        }
        $user->save();

        $summary = collect($changes)->map(fn ($c, $f) => "{$f}: {$c[0]} -> {$c[1]}")->implode('; ');
        ActivityLog::record($user->id, 'user_renamed', $summary);
        $this->info('Updated. The password, role and quote history are unchanged.');
        $this->line("Sign in with: {$user->username}");

        return self::SUCCESS;
    }
}
