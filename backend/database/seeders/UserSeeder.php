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
            ['admin',      'Administrator', User::ROLE_ADMIN,     '',                               'SEED_ADMIN_PASSWORD'],
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
            $password = env($envKey);
            if (!$password) {
                $password = Str::password(16);
                $generated[] = [$username, $password];
            }

            User::updateOrCreate(
                ['username' => $username],
                [
                    'full_name' => $fullName,
                    'role'      => $role,
                    'email'     => $email,
                    'password'  => Hash::make($password),
                ]
            );
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
