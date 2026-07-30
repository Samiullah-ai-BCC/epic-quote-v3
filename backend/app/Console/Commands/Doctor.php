<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * READ-ONLY production triage. Born from "I can't log in and /api/constants returns 500":
 * from outside, a half-migrated database and a wrong password are the same generic error, so
 * there was no way to tell them apart without guessing. This prints the facts that separate
 * them — which tables exist, whether any migration is pending, and who is actually in the
 * users table — without touching a single row or revealing a password hash.
 *
 * Run it on the environment that is failing, not on your laptop: the whole point is that the
 * two have different databases.
 */
class Doctor extends Command
{
    protected $signature = 'app:doctor';

    protected $description = 'Read-only health check: DB connection, tables, pending migrations, users';

    /** Tables the API needs to answer login + /api/constants. */
    // NB: activity_log is SINGULAR (see ActivityLog::$table) — guessing the Laravel-default
    // plural here made this command report a missing table on a perfectly healthy database,
    // which is the exact false alarm it was written to prevent.
    private const CORE_TABLES = [
        'users', 'settings', 'quotes', 'companies', 'activity_log',
        'personal_access_tokens', 'migrations',
    ];

    public function handle(): int
    {
        $this->line('');
        $this->info('── CONNECTION ─────────────────────────────');
        try {
            $name = DB::connection()->getDatabaseName();
            DB::select('select 1');
            $this->line('  driver   : ' . DB::connection()->getDriverName());
            $this->line('  database : ' . $name);
            $this->line('  status   : CONNECTED');
        } catch (\Throwable $e) {
            $this->error('  CANNOT CONNECT: ' . $e->getMessage());
            return self::FAILURE;   // nothing below can be trusted without a connection
        }

        $this->line('');
        $this->info('── CORE TABLES ────────────────────────────');
        $missing = [];
        foreach (self::CORE_TABLES as $t) {
            $ok = Schema::hasTable($t);
            if (!$ok) {
                $missing[] = $t;
            }
            $this->line(sprintf('  %-24s %s', $t, $ok ? 'present' : 'MISSING'));
        }

        $this->line('');
        $this->info('── MIGRATIONS ─────────────────────────────');
        if (!Schema::hasTable('migrations')) {
            $this->error('  migrations table missing — this database has never been migrated.');
        } else {
            $ran = DB::table('migrations')->count();
            $files = glob(database_path('migrations/*.php')) ?: [];
            $this->line('  applied in DB : ' . $ran);
            $this->line('  files in repo : ' . count($files));
            if (count($files) > $ran) {
                $this->warn('  PENDING: ' . (count($files) - $ran) . ' migration(s) not applied here.');
                $this->warn('  Fix with: php artisan migrate --force');
            }
        }

        $this->line('');
        $this->info('── USERS ──────────────────────────────────');
        if (!Schema::hasTable('users')) {
            $this->error('  users table missing — nobody can log in until migrations run.');
        } else {
            // full_name is read by /api/constants and by the login response; a schema that
            // predates it 500s those endpoints while login itself still "works".
            foreach (['username', 'email', 'full_name', 'role', 'password'] as $col) {
                if (!Schema::hasColumn('users', $col)) {
                    $this->error('  users.' . $col . ' COLUMN MISSING');
                }
            }
            $users = DB::table('users')->orderBy('id')->get(['id', 'username', 'email', 'role']);
            $this->line('  count: ' . $users->count());
            foreach ($users as $u) {
                $this->line(sprintf('   %-4s %-22s %-34s %s', $u->id, $u->username, $u->email ?: '(no email)', $u->role ?? ''));
            }
            if ($users->isEmpty()) {
                $this->warn('  No users. Create one with: php artisan app:ensure-admin --username=you');
            }
        }

        $this->shopifySection();

        $this->line('');
        if ($missing !== []) {
            $this->error('VERDICT: schema incomplete — missing: ' . implode(', ', $missing));
            $this->line('Run: php artisan migrate --force');
            return self::FAILURE;
        }
        $this->info('VERDICT: schema looks complete.');

        return self::SUCCESS;
    }

    /**
     * Shopify: the SCOPES the token actually carries, and whether the warehouse resolves.
     *
     * Born from a two-day hunt (2026-07-30): every payment link came out "Inventory not tracked" on
     * the wrong warehouse, and the failure was invisible from the app — locations.json answered 403
     * for a missing scope, setInventoryOne returned false, and the controller's untrack fallback kept
     * the link payable, so nothing looked broken. Worse, the app's scopes are a property of the TOKEN:
     * granting a scope in the Shopify admin changes nothing until the NEW token is in .env, which is
     * indistinguishable from "the grant didn't work" unless you can see the scope list.
     * Read-only: this asks Shopify what it will allow, and writes nothing.
     */
    private function shopifySection(): void
    {
        $this->line('');
        $this->info('── SHOPIFY ────────────────────────────────');

        if (!\App\Services\ShopifyService::configured()) {
            $this->warn('  not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_API_TOKEN) — payment links are off.');
            return;
        }
        $domain  = \App\Services\ShopifyService::domain();
        $this->line('  store: '.$domain);

        try {
            $resp = \Illuminate\Support\Facades\Http::timeout(15)
                ->withHeaders(['X-Shopify-Access-Token' => config('services.shopify.token')])
                ->get("https://{$domain}/admin/oauth/access_scopes.json");
        } catch (\Throwable $e) {
            $this->error('  could not reach Shopify: '.$e->getMessage());
            return;
        }
        if (!$resp->successful()) {
            $this->error('  token rejected by Shopify (HTTP '.$resp->status().') — wrong or revoked token.');
            return;
        }

        $scopes = collect($resp->json('access_scopes') ?? [])->pluck('handle')->all();
        $this->line('  scopes: '.(implode(', ', $scopes) ?: '(none)'));

        // What each scope BUYS, so a missing one names the feature it breaks rather than itself.
        $needed = [
            'write_products'  => 'create the payment-link product',
            'read_products'   => 'rebuild a link URL from its product',
            'read_locations'  => 'find the US warehouse (needed unless SHOPIFY_LOCATION_ID is set)',
            'read_inventory'  => 'read stock levels',
            'write_inventory' => 'stock the link with 1 at the US warehouse',
        ];
        $missing = [];
        foreach ($needed as $scope => $buys) {
            $has = in_array($scope, $scopes, true);
            $this->line(sprintf('   %-16s %-8s %s', $scope, $has ? 'YES' : 'MISSING', $buys));
            if (!$has) {
                $missing[] = $scope;
            }
        }

        $locationId = config('services.shopify.location_id');
        if ($locationId) {
            $this->line('  location: pinned by SHOPIFY_LOCATION_ID='.$locationId.' (no lookup needed)');
        } else {
            $resolved = \App\Services\ShopifyService::usLocationId();
            $resolved
                ? $this->line('  location: resolved "'.config('services.shopify.location_name').'" → '.$resolved)
                : $this->error('  location: COULD NOT RESOLVE — new links will fall back to untracked inventory'
                    . ' on the store default warehouse. Grant read_locations, or set SHOPIFY_LOCATION_ID.');
        }

        if ($missing !== []) {
            $this->warn('  Grant the missing scopes in Shopify → Develop apps → your app → Configuration,');
            $this->warn('  then re-install/update the app AND copy the NEW token into SHOPIFY_API_TOKEN.');
            $this->warn('  Scopes travel with the token: granting them changes nothing until the token is replaced.');
        }
    }
}
