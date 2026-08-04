<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rename a user's login name (and their display name when it is the same word).
 *
 * WHY A COMMAND AND NOT A ONE-LINE UPDATE. The username is not confined to `users`: quotes carry
 * the rep and the assignee as STRINGS, and several history tables record an actor the same way.
 * A rename that touches only `users` leaves the old spelling printed on quotes and in audit trails
 * — the account is renamed while the documents still say otherwise. This walks every column that
 * can hold the name, reports what it found, and changes all of them together.
 *
 * It is idempotent: running it twice is a no-op, because the second run finds nothing under the old
 * name. --dry-run prints the exact same report and writes nothing, which is how it should be run on
 * production first.
 *
 * Usage: php artisan users:rename musavir mussawer [--display="Mussawer"] [--dry-run]
 */
class RenameUsername extends Command
{
    protected $signature = 'users:rename
        {from : the current username}
        {to : the new username}
        {--display= : new full name; defaults to the new username capitalised when the old full name matched the old username}
        {--dry-run : report what would change and write nothing}';

    protected $description = 'Rename a username everywhere it is stored, including quote and history strings';

    /** Every column that can hold a person's name as free text. Missing tables/columns are skipped. */
    private const NAME_COLUMNS = [
        'quotes'            => ['sales_rep', 'assigned_to', 'waiting_on', 'created_by', 'updated_by'],
        'companies'         => ['rep'],
        'status_history'    => ['actor', 'changed_by', 'user'],
        'activity_log'      => ['actor', 'user', 'username'],
        'quote_revisions'   => ['actor', 'created_by'],
        'quote_checkpoints' => ['actor', 'created_by'],
        'payment_links'     => ['created_by', 'actor'],
    ];

    public function handle(): int
    {
        $from = trim((string) $this->argument('from'));
        $to = trim((string) $this->argument('to'));
        $dry = (bool) $this->option('dry-run');

        if ($from === '' || $to === '') {
            $this->error('Both the current and the new username are required.');
            return self::FAILURE;
        }

        $user = User::where('username', $from)->first();
        if (!$user) {
            // Not an error: the point of idempotency is that a second run is a quiet no-op.
            $this->info(User::where('username', $to)->exists()
                ? "Nothing to do — '$from' does not exist and '$to' already does."
                : "Nothing to do — no user named '$from'.");
            return self::SUCCESS;
        }

        if (User::where('username', $to)->whereKeyNot($user->getKey())->exists()) {
            $this->error("Refusing: another account already uses the username '$to'.");
            return self::FAILURE;
        }

        // Only rename the display name when it was tracking the username. A full name the team set
        // deliberately ("Mussawer Ahmed") is theirs, not this command's to overwrite.
        $display = $this->option('display');
        if ($display === null && strcasecmp((string) $user->full_name, $from) === 0) {
            $display = ucfirst($to);
        }

        $this->line("user #{$user->id}: username '{$user->username}' -> '$to'");
        if ($display !== null) {
            $this->line("user #{$user->id}: full name '{$user->full_name}' -> '$display'");
        }

        $stringHits = [];
        foreach (self::NAME_COLUMNS as $table => $columns) {
            if (!Schema::hasTable($table)) continue;
            foreach ($columns as $column) {
                if (!Schema::hasColumn($table, $column)) continue;
                $count = DB::table($table)->where($column, $from)->count();
                if ($count > 0) {
                    $stringHits[] = [$table, $column, $count];
                    $this->line("$table.$column: $count row(s)");
                }
            }
        }
        if (!$stringHits) {
            $this->line('no quote or history rows reference the old name');
        }

        if ($dry) {
            $this->info('dry run — nothing written');
            return self::SUCCESS;
        }

        // One transaction: a rename that renames the account but fails partway through the quote
        // strings leaves the two disagreeing, which is the exact state this command exists to avoid.
        DB::transaction(function () use ($user, $to, $display, $stringHits, $from) {
            $user->username = $to;
            if ($display !== null) $user->full_name = $display;
            $user->save();

            foreach ($stringHits as [$table, $column]) {
                DB::table($table)->where($column, $from)->update([$column => $display ?? $to]);
            }
        });

        $this->info("renamed '$from' to '$to'");
        return self::SUCCESS;
    }
}
