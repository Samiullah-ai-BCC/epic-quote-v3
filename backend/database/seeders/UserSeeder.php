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
     *
     * ── THE DATABASE OUTRANKS THIS FILE (2026-07-30) ────────────────────────────────────────
     * This seeder runs on EVERY container boot (see backend/Dockerfile CMD), so anything it wrote
     * unconditionally was a change that silently reverted on the next deploy. Three symptoms, all
     * reported as "nothing I do sticks":
     *   • a role or email edited on the Users page flipped back (profile fields were re-applied);
     *   • a seeded user who had been DELETED came back on the next deploy, with a fresh random
     *     password nobody had;
     *   • with a SEED_*_PASSWORD still set in the environment, a password changed in the UI was
     *     reset to the env value on the next deploy.
     * So: this seeder now only POPULATES AN EMPTY users table. Once a single user exists, the
     * database is the authority on who exists, what their role is and what their password is —
     * user management lives in the Users page (and `php artisan app:ensure-admin` for lockouts).
     * The one deliberate exception is an explicit SEED_*_PASSWORD, kept as break-glass for a
     * lockout; it warns loudly, because leaving that variable set re-creates symptom three.
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

        // The primary admin login. Login is by USERNAME, so username IS the login id.
        $adminUsername = 'sami.ullah';

        // An EXISTING install is left alone. Counting rows (not "does this username exist") is what
        // makes a deletion final: per-user existence checks are exactly what resurrected the six
        // admins that had been removed on purpose.
        if (User::query()->exists()) {
            $this->applyBreakGlassPasswords($seed, $adminUsername);
            $this->retireLegacyAdmins();
            return;
        }

        $this->command?->info('users table is empty — seeding the initial accounts.');
        $generated = [];

        foreach ($seed as [$username, $fullName, $role, $email, $envKey]) {
            $password = env($envKey);
            if (!$password) {
                $password = Str::password(16);
                $generated[] = [$username, $password];
            }
            User::create([
                'username'  => $username,
                'full_name' => $fullName,
                'role'      => $role,
                'email'     => $email,
                'password'  => Hash::make($password),
            ]);
        }

        // Renames any legacy placeholder row ('admin' / 'test@123.com') in place — keeping that
        // user's id and their quotes — rather than adding a second admin beside it. (Unreachable on a
        // genuinely empty table; kept because this branch also runs on a DB that was wiped by hand.)
        $admin = User::where('username', $adminUsername)->first()
            ?? User::where('username', 'admin')->first()
            ?? User::where('username', 'test@123.com')->first();

        $adminPassword = env('SEED_ADMIN_PASSWORD');
        if (!$adminPassword) {
            $adminPassword = Str::password(16);
            $generated[] = [$adminUsername, $adminPassword];
        }
        $adminAttributes = [
            'username'  => $adminUsername,
            'full_name' => 'Sami Ullah',
            'role'      => User::ROLE_ADMIN,
            'email'     => 'sami.ullah@bluecascade.org',
            'password'  => Hash::make($adminPassword),
        ];

        if ($admin) {
            $admin->forceFill($adminAttributes)->save();
        } else {
            User::create($adminAttributes);
        }

        $this->retireLegacyAdmins();

        if ($generated) {
            $this->command?->warn(str_repeat('=', 60));
            $this->command?->warn('Generated random passwords — store these, they will not show again:');
            foreach ($generated as [$u, $p]) {
                $this->command?->line(sprintf('  %-12s / %s', $u, $p));
            }
            $this->command?->warn(str_repeat('=', 60));
        }
    }

    /**
     * BREAK-GLASS ONLY: on an existing install, an explicitly-set SEED_*_PASSWORD still resets that
     * one account, so a lockout can be fixed from the Render dashboard without a shell. It shouts
     * about itself because leaving the variable in place resets the password on EVERY deploy —
     * which is the reverting-password bug, just opt-in.
     */
    private function applyBreakGlassPasswords(array $seed, string $adminUsername): void
    {
        $rows = $seed;
        $rows[] = [$adminUsername, null, null, null, 'SEED_ADMIN_PASSWORD'];

        foreach ($rows as [$username, , , , $envKey]) {
            $password = env($envKey);
            if (!$password) {
                continue;
            }
            $user = User::where('username', $username)->first();
            if (!$user) {
                $this->command?->warn("{$envKey} is set but user '{$username}' does not exist — "
                    . "create them on the Users page, or run: php artisan app:ensure-admin --username={$username}");
                continue;
            }
            $user->forceFill(['password' => Hash::make($password)])->save();
            $this->command?->warn("{$envKey} is set: reset the password of '{$username}'. "
                . 'REMOVE that variable from the environment now — while it is set, every deploy '
                . 'overwrites this password and any change made in the app is lost.');
        }
    }

    /**
     * The V1 placeholder admins ('admin', 'test@123.com') shipped the password '123456789!', which
     * is in this repo's public git history — i.e. a usable backdoor into production. Their rows are
     * left in place (they may own quotes; deleting them is not this seeder's call) but the known
     * password is scrambled so it stops working. Safe to repeat: nobody can be using these.
     */
    private function retireLegacyAdmins(): void
    {
        foreach (User::whereIn('username', ['test@123.com', 'admin'])->get() as $stale) {
            $stale->forceFill(['password' => Hash::make(Str::password(32))])->save();
            $this->command?->warn("Legacy admin '{$stale->username}' (id={$stale->id}) still exists; "
                . 'its password has been scrambled. Reassign anything it owns, then delete it.');
        }
    }
}
