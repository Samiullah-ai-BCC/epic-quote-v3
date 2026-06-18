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
    }
}
