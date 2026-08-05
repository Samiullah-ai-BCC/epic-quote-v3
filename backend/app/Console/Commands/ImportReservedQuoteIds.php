<?php

namespace App\Console\Commands;

use App\Models\ReservedQuoteId;
use App\Support\QuoteIdAllocator;
use Illuminate\Console\Command;

/**
 * Load the quote IDs that are in use in ANOTHER system, so this one never hands them out.
 *
 * Airtable is still live, so this is not a one-off: re-run it whenever a fresh export is taken and
 * it will add whatever is new. Idempotent by construction — the reserved table has a unique index
 * on the ID, and existing rows are left exactly as they are.
 *
 * The export is not tidy. Of 3,565 rows carrying an ID, 814 are written '#EC100187' and some have
 * stray spaces; those are the SAME id as EC100187 and must not be imported as a second one, or the
 * allocator's idea of "taken" quietly fragments. Everything is normalised through the one function
 * the allocator itself uses.
 *
 * Usage: php artisan quotes:import-reserved-ids "C:/path/Quotes.csv" [--column="Quote ID"] [--dry-run]
 */
class ImportReservedQuoteIds extends Command
{
    protected $signature = 'quotes:import-reserved-ids
        {file? : path to a CSV export; defaults to the ID list bundled in database/data}
        {--column=Quote ID : the header of the column holding the IDs}
        {--source=airtable : label stored against each imported row}
        {--dry-run : report what WOULD be imported and write nothing}';

    protected $description = 'Reserve quote IDs used in another system so auto-assignment never collides';

    public function handle(): int
    {
        // Default to the list shipped WITH the code. The export lives on somebody's laptop and the
        // server cannot see it, so a bundled, IDs-only file is what makes this runnable on a
        // deployed container at all. It carries no customer name, email or price — only the
        // numbers that must not be handed out twice.
        $file = (string) ($this->argument('file') ?: database_path('data/reserved-quote-ids.csv'));
        if (!is_readable($file)) {
            $this->error("Cannot read {$file}");
            return self::FAILURE;
        }

        $handle = fopen($file, 'r');
        $header = fgetcsv($handle);
        if (!$header) {
            $this->error('The file has no header row.');
            return self::FAILURE;
        }
        // Excel writes a BOM on the first header; without stripping it the first column never
        // matches by name and the import silently finds nothing.
        $header = array_map(fn ($h) => trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h)), $header);

        $wanted = trim((string) $this->option('column'));
        $index = array_search($wanted, $header, true);
        if ($index === false) {
            $this->error("No '{$wanted}' column. Found: ".implode(', ', array_slice($header, 0, 12)));
            fclose($handle);
            return self::FAILURE;
        }

        $seen = [];
        $skipped = 0;
        while (($row = fgetcsv($handle)) !== false) {
            $raw = $row[$index] ?? '';
            if (trim((string) $raw) === '') continue;
            $id = QuoteIdAllocator::normalise($raw);
            if ($id === null) { $skipped++; continue; }
            $seen[$id] = (int) substr($id, 2);
        }
        fclose($handle);

        $existing = ReservedQuoteId::whereIn('quote_id', array_keys($seen))->pluck('quote_id')->all();
        $new = array_diff_key($seen, array_flip($existing));

        $this->line('rows with a usable ID : '.count($seen));
        $this->line('unreadable, skipped   : '.$skipped);
        $this->line('already reserved      : '.count($existing));
        $this->line('to add                : '.count($new));
        if ($new) {
            $numbers = array_values($new);
            $this->line('numeric range         : '.min($numbers).' .. '.max($numbers));
        }

        if ($this->option('dry-run')) {
            $this->info('dry run — nothing written');
            return self::SUCCESS;
        }

        $source = (string) $this->option('source');
        $rows = [];
        foreach ($new as $id => $number) {
            $rows[] = ['quote_id' => $id, 'number' => $number, 'source' => $source,
                       'created_at' => now(), 'updated_at' => now()];
        }
        foreach (array_chunk($rows, 500) as $chunk) {
            ReservedQuoteId::insertOrIgnore($chunk);
        }

        $this->info('reserved '.count($rows).' id(s); '.ReservedQuoteId::count().' held in total');
        return self::SUCCESS;
    }
}
