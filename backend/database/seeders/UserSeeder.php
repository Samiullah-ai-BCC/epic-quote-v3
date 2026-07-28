<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    /**
     * V1 init_db() seeded two groups: core defaults (admin/rod/ed/sami) and named
     * business admins. V3 hardening (#133): passwords come from env, never the V1
     * weak literals (admin123 etc). If an env var is unset a strong random password
     * is generated and printed once so it can be reset.
     */
    public function run(): void
    {
        // username, full_name, role, email, env-key for password
        $seed = [
            ['rod',        'Rod Muffet',    User::ROLE_SALES_REP, 'rod@epiccrafting.com',           'SEED_ROD_PASSWORD'],
            ['ed',         'ED',            User::ROLE_SALES_REP, '',                               'SEED_ED_PASSWORD'],
            ['sami',       'Sir Sami',      User::ROLE_MANAGER,   '',                               'SEED_SAMI_PASSWORD'],
            ['alishan',    'Ali Shan',      User::ROLE_ADMIN,     'alishan@bluecascade.org',        'SEED_ALISHAN_PASSWORD'],
            ['faraz',      'Faraz Awan',    User::ROLE_ADMIN,     'faraz@epiccraftings.com',        'SEED_FARAZ_PASSWORD'],
            ['musavir',    'Musavir',       User::ROLE_ADMIN,     'mussawer@bluecascade.org',       'SEED_MUSAVIR_PASSWORD'],
            ['khola',      'Khola',         User::ROLE_ADMIN,     'khola@bluecascade.org',          'SEED_KHOLA_PASSWORD'],
            ['khansa',     'Khansa',        User::ROLE_ADMIN,     'khansa.ikram@bluecascade.org',   'SEED_KHANSA_PASSWORD'],
            ['usmanaltaf', 'Usman Altaf',   User::ROLE_ADMIN,     'usmanaltaf@epiccrafting.com',    'SEED_USMANALTAF_PASSWORD'],
        ];

        $generated = [];

        foreach ($seed as [$username, $fullName, $role, $email, $envKey]) {
            $user = User::where('username', $username)->first();

            // Profile fields are safe to re-apply on every run.
            $attributes = [
                'full_name' => $fullName,
                'role'      => $role,
                'email'     => $email,
            ];

            // A PASSWORD IS ONLY EVER WRITTEN WHEN THE ACCOUNT IS CREATED, or when an explicit
            // SEED_*_PASSWORD is supplied. The old code hashed a value on EVERY run and, with no
            // env var set, that value was Str::password(16) — a random string printed once to the
            // console. Re-seeding therefore overwrote the passwords of accounts that already
            // existed with secrets nobody kept, and alishan/faraz/musavir/khola/khansa/usmanaltaf
            // were left unable to log in at all ("no other user can log in", 2026-07-28; their
            // last_login was still NULL). A password now survives reseeding; use
            // `php artisan app:ensure-admin --username=…` to set one deliberately.
            $envPassword = env($envKey);
            if ($envPassword) {
                $attributes['password'] = Hash::make($envPassword);
            } elseif (!$user) {
                $newPassword = Str::password(16);
                $generated[] = [$username, $newPassword];
                $attributes['password'] = Hash::make($newPassword);
            }

            if ($user) {
                $user->forceFill($attributes)->save();
            } else {
                User::create($attributes + ['username' => $username]);
            }
        }

        // Primary admin login. Renames any legacy placeholder row ('admin' / 'test@123.com') in
        // place — keeping that user's id and their quotes — so the seed no longer resurrects the
        // 'test@123.com' account on every deploy. Login is by USERNAME, so username IS the login id.
        $admin = User::where('username', 'sami.ullah')->first()
            ?? User::where('username', 'admin')->first()
            ?? User::where('username', 'test@123.com')->first();

        $adminAttributes = [
            'username'  => 'sami.ullah',
            'full_name' => 'Sami Ullah',
            'role'      => User::ROLE_ADMIN,
            'email'     => 'sami.ullah@bluecascade.org',
        ];

        // Same rule as the loop: the password is written on CREATION only (or from an explicit
        // SEED_ADMIN_PASSWORD). Previously this block hard-coded Hash::make('123456789!') on every
        // run, which both shipped a committed password (PLATFORM-MAP §9 item 10) and reset the
        // admin's real password back to it on every deploy. Rotate deliberately with
        // `php artisan app:ensure-admin --username=sami.ullah`, which prompts instead of echoing.
        if ($admin && env('SEED_ADMIN_PASSWORD')) {
            $adminAttributes['password'] = Hash::make(env('SEED_ADMIN_PASSWORD'));
        } elseif (!$admin) {
            $adminPassword = env('SEED_ADMIN_PASSWORD') ?: Str::password(16);
            if (!env('SEED_ADMIN_PASSWORD')) {
                $generated[] = ['sami.ullah', $adminPassword];
            }
            $adminAttributes['password'] = Hash::make($adminPassword);
        }

        if ($admin) {
            $admin->forceFill($adminAttributes)->save();
        } else {
            User::create($adminAttributes);
        }

        // If a 'sami.ullah' row already existed, the legacy placeholder above was NOT renamed and
        // survives as a separate admin whose password ('123456789!') is committed in this repo's
        // history — i.e. a usable backdoor into production. Its row is left in place (it may own
        // quotes; deleting it is not this seeder's call) but its password is scrambled so the known
        // one stops working, and the operator is told to retire it deliberately.
        foreach (User::whereIn('username', ['test@123.com', 'admin'])->get() as $stale) {
            $stale->forceFill(['password' => Hash::make(Str::password(32))])->save();
            $this->command?->warn("Legacy admin '{$stale->username}' (id={$stale->id}) still exists; "
                . 'its password has been scrambled. Reassign anything it owns, then delete it.');
        }

        if ($generated) {
            $this->command?->warn(str_repeat('=', 60));
            $this->command?->warn('Generated random passwords — store these, they will not show again:');
            foreach ($generated as [$u, $p]) {
                $this->command?->line(sprintf('  %-12s / %s', $u, $p));
            }
            $this->command?->warn(str_repeat('=', 60));
        }
    }
}
