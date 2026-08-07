<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        // V1 counters start at 100000; first issued id increments to 100001
        // → EC100001 / ORD-100001 (#25, #26)
        Setting::firstOrCreate(['key' => 'quote_counter'], ['value' => '100000']);
        Setting::firstOrCreate(['key' => 'order_counter'], ['value' => '100000']);

        // The company's wire-transfer details, printed on proposals as the alternative to the
        // Shopify pay button (Shopify takes 3% of everything paid through it).
        //
        // SEEDED HERE, not by a one-off command, because `db:seed --force` runs on every deploy
        // (backend/Dockerfile) while a hand-run command does not — which is exactly how the first
        // deploy of this feature reached production with no details and printed nothing.
        //
        // firstOrCreate, never update: once an admin has corrected a digit in Settings, the next
        // deploy must not quietly put the old number back. A wrong account number is money sent
        // somewhere it cannot be recovered from.
        Setting::firstOrCreate(['key' => 'bank_details'], ['value' => json_encode([
            'title'          => 'Epic Craftings Inc. (Bank of America)',
            'account_number' => '444030406654',
            'routing_number' => '026009593',
            'routing_note'   => 'Wire Transfer',
            'address'        => '101 E Luzerne St # B Philadelphia, PA 19124 4201',
        ])]);
    }
}
