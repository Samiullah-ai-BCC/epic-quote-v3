<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Existing quotes were created with price 0 (the old default), so they showed "—" on cards and
// counted as 0 in the monthly total. Backfill them to the new $1,200 default.
return new class extends Migration
{
    public function up(): void
    {
        DB::table('quotes')->where('price', 0)->orWhereNull('price')->update(['price' => 1200]);
    }

    public function down(): void
    {
        // No-op: we cannot tell which quotes were originally 0 vs intentionally 1200.
    }
};
