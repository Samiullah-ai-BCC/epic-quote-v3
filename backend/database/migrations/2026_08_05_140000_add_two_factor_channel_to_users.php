<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How this account receives its second factor.
 *
 * A COLUMN, not a hardcoded username. The request was for one person, but "Rod gets email codes"
 * written into an if-statement becomes a lie the first time somebody else needs it or Rod's
 * username changes — and this is the login path, where a stale condition is a lockout. The column
 * defaults to 'totp', so every existing account keeps the authenticator flow untouched, and the
 * channel is switched per user with `php artisan users:two-factor-channel`.
 *
 * The emailed code is stored HASHED with an expiry and an attempt counter, for the same reason a
 * password is: the users table is the first thing read in a database leak, and a plaintext live
 * OTP beside the account it protects would hand over the second factor with the first.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('two_factor_channel', 16)->default('totp')->after('two_factor_confirmed_at');
            $table->text('two_factor_email_code')->nullable()->after('two_factor_channel');
            $table->timestamp('two_factor_email_expires_at')->nullable()->after('two_factor_email_code');
            $table->unsignedSmallInteger('two_factor_email_attempts')->default(0)->after('two_factor_email_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'two_factor_channel',
                'two_factor_email_code',
                'two_factor_email_expires_at',
                'two_factor_email_attempts',
            ]);
        });
    }
};
