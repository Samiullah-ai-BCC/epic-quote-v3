<?php

namespace App\Console\Commands;

use App\Models\Setting;
use Illuminate\Console\Command;

/**
 * Seeds the company's wire-transfer details — the ones printed on proposals as the alternative to
 * the Shopify pay button (Shopify takes 3% of everything paid through it).
 *
 * Idempotent and NON-DESTRUCTIVE: if details are already saved it leaves them alone and says so.
 * An admin who has corrected an account number in Settings must not have it silently reverted by
 * a deploy step re-running this command. --force is the deliberate way to overwrite.
 */
class SeedBankDetails extends Command
{
    protected $signature = 'app:seed-bank-details {--force : Overwrite details that are already saved}';

    protected $description = "Seed the company bank details printed on proposals";

    private const DEFAULTS = [
        'title'          => 'Epic Craftings Inc. (Bank of America)',
        'account_number' => '444030406654',
        'routing_number' => '026009593',
        'routing_note'   => 'Wire Transfer',
        'address'        => '101 E Luzerne St # B Philadelphia, PA 19124 4201',
    ];

    public function handle(): int
    {
        $current = Setting::bankDetails();
        $alreadySet = implode('', $current) !== '';

        if ($alreadySet && !$this->option('force')) {
            $this->info('Bank details are already saved — left untouched. Re-run with --force to overwrite.');
            foreach ($current as $field => $value) {
                $this->line("  {$field}: ".($value ?: '(empty)'));
            }
            return self::SUCCESS;
        }

        Setting::put('bank_details', json_encode(self::DEFAULTS));
        $this->info($alreadySet ? 'Bank details overwritten.' : 'Bank details seeded.');
        foreach (Setting::bankDetails() as $field => $value) {
            $this->line("  {$field}: {$value}");
        }

        return self::SUCCESS;
    }
}
