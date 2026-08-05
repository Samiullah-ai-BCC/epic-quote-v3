<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\ReservedQuoteId;
use App\Models\User;
use App\Support\QuoteIdAllocator;
use Illuminate\Console\Command;

/**
 * Turn automatic quote IDs on or off for one account.
 *
 * Usage: php artisan users:auto-quote-id rod on [--dry-run]
 *        php artisan users:auto-quote-id rod off
 */
class SetAutoQuoteId extends Command
{
    protected $signature = 'users:auto-quote-id
        {user : username or email of the account}
        {state : on or off}
        {--dry-run : report what WOULD change and write nothing}';

    protected $description = 'Assign quote IDs automatically for an account instead of asking them to type one';

    public function handle(): int
    {
        $state = strtolower(trim((string) $this->argument('state')));
        if (!in_array($state, ['on', 'off'], true)) {
            $this->error("State must be 'on' or 'off'.");
            return self::FAILURE;
        }
        $want = $state === 'on';

        $key = strtolower(trim((string) $this->argument('user')));
        // Same resolution order as the login controller, so this configures the row that actually
        // signs in under that identifier.
        $user = User::where('username', $key)->first()
            ?? User::whereRaw('LOWER(email) = ?', [$key])->orderBy('id')->first();

        if (!$user) {
            $this->error("No account matches '{$key}'.");
            return self::FAILURE;
        }

        $this->line("Account id={$user->id} ({$user->username}, {$user->role})");

        if ($want && ReservedQuoteId::count() === 0) {
            // Not fatal, but it is the difference between "unique" and "unique here". Airtable holds
            // thousands of IDs this database has never seen; without them imported, the allocator is
            // only checking half the world.
            $this->warn('No reserved IDs are loaded. Import the other system\'s IDs first:');
            $this->warn('  php artisan quotes:import-reserved-ids "<export>.csv"');
        }

        if ($user->usesAutoQuoteId() === $want) {
            $this->info("Already ".($want ? 'on' : 'off')." — nothing to change.");
            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->line('auto_quote_id: '.($user->usesAutoQuoteId() ? 'on' : 'off').' -> '.($want ? 'on' : 'off'));
            if ($want) $this->line('next id would be: '.QuoteIdAllocator::next());
            $this->info('dry run — nothing written');
            return self::SUCCESS;
        }

        $user->forceFill(['auto_quote_id' => $want])->save();
        ActivityLog::record($user->id, 'auto_quote_id_changed',
            "{$user->username}'s quote IDs are now ".($want ? 'assigned automatically' : 'typed by hand'));

        $this->info("{$user->username}: quote IDs ".($want ? 'assigned automatically' : 'typed by hand'));
        if ($want) $this->line('next id: '.QuoteIdAllocator::next());

        return self::SUCCESS;
    }
}
