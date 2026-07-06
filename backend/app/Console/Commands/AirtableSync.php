<?php

namespace App\Console\Commands;

use App\Services\AirtableQuoteSync;
use Illuminate\Console\Command;

/**
 * Two-way Airtable synchronization (scope: Quotes-working + Side Views).
 *   php artisan airtable:sync                  → pull quotes + side views (upsert, lossless)
 *   php artisan airtable:sync --quotes         → quotes only
 *   php artisan airtable:sync --sideviews      → side-view library only
 * Safe to run repeatedly: upserts by airtable_id / library name, never duplicates.
 */
class AirtableSync extends Command
{
    protected $signature = 'airtable:sync {--quotes} {--sideviews}';
    protected $description = 'Pull Airtable Quotes-working and Side Views into the estimator (lossless upsert)';

    public function handle(): int
    {
        if (!AirtableQuoteSync::configured()) {
            $this->error('AIRTABLE_API_KEY / AIRTABLE_BASE_ID / AIRTABLE_QUOTES_TABLE are not set.');
            return self::FAILURE;
        }
        $doQuotes = $this->option('quotes') || !$this->option('sideviews');
        $doViews  = $this->option('sideviews') || !$this->option('quotes');

        if ($doViews) {
            $this->info('Importing Side Views library…');
            [$added, $skipped] = AirtableQuoteSync::importSideViews(fn ($n) => $n % 10 === 0 ? $this->output->write('.') : null);
            $this->newLine();
            $this->info("Side views: {$added} added, {$skipped} skipped (already present / no file).");
        }
        if ($doQuotes) {
            $this->info('Importing Quotes-working…');
            [$created, $updated, $skipped] = AirtableQuoteSync::importQuotes(fn ($n) => $n % 100 === 0 ? $this->output->write('.') : null);
            $this->newLine();
            $this->info("Quotes: {$created} created, {$updated} updated, {$skipped} skipped.");
        }
        return self::SUCCESS;
    }
}
