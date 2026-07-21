<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds sign_catalog_entries from database/data/fa_sign_catalog.json — the same verbatim
 * parse of the FA sign-type sheet that frontend/src/generator/faCatalogData.js is generated
 * from (docs/sign-matrix/). Re-running is idempotent: it replaces the table wholesale rather
 * than upserting row-by-row, since the whole catalog is regenerated together whenever the
 * sheet changes (no per-row identity worth preserving).
 */
class SignCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('data/fa_sign_catalog.json');
        if (!file_exists($path)) {
            $this->command?->warn("Skipped: $path not found.");
            return;
        }
        $rows = json_decode(file_get_contents($path), true) ?? [];

        DB::table('sign_catalog_entries')->truncate();
        $now = now();
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('sign_catalog_entries')->insert(array_map(fn ($r) => [
                'family'    => $r['family'],
                'sign_type' => $r['sign_type'],
                'thickness' => $r['thickness'],
                'mounting'  => $r['mounting'],
                'package'   => $r['package'],
                'sideview'  => $r['sideview'],
                'lines'     => json_encode($r['lines'], JSON_UNESCAPED_UNICODE),
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));
        }

        $this->command?->info('sign_catalog_entries seeded: ' . count($rows) . ' rows');
    }
}
