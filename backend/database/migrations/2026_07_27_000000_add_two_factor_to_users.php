<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two-factor authentication columns.
 *
 * Nullable throughout and 2FA is OPT-IN: an account with a null secret logs in exactly as it
 * always has. Nobody is locked out by this migration running, which matters because it lands on
 * a live production database that people are using today.
 *
 * `two_factor_confirmed_at` is what makes 2FA live for an account — a secret alone does NOT
 * enable it. The gap between "secret generated" and "first code verified" is where a rep with a
 * mis-scanned QR would otherwise lock themselves out permanently.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at']);
        });
    }
};
