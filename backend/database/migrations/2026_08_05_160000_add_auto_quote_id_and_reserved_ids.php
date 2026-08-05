<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Auto-assigned quote IDs for the accounts that ask for them, and the list of IDs that are taken
 * SOMEWHERE ELSE.
 *
 * `reserved_quote_ids` is the important half. This database holds ~100 quote IDs; Airtable holds
 * 3,551 more, 55 of which already appear in both. Any "highest + 1" computed from this database
 * alone would cheerfully hand out an ID Airtable used two years ago, and the collision would only
 * surface when somebody tried to reconcile the two systems. So the Airtable IDs are imported here
 * and treated as occupied, and "taken" means taken in either system.
 *
 * Kept as its own table rather than dummy rows in `quotes`: a reserved ID is not a quote. It has no
 * customer, no price and no history, and it must never appear in a list, a report or a total.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reserved_quote_ids', function (Blueprint $table) {
            $table->id();
            // Stored UPPERCASE and normalised (EC + digits). The importer strips the '#' prefix and
            // stray spaces that 814 of the Airtable rows carry, so a comparison is a plain equality
            // rather than a regex at read time.
            $table->string('quote_id', 20)->unique();
            $table->unsignedBigInteger('number')->index();   // the numeric part, for range queries
            $table->string('source', 40)->default('airtable');
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            // Per-user, not a hardcoded username — the same reasoning as the 2FA channel: this is
            // the quote-creation path, and a stale condition there is a rep who cannot start work.
            $table->boolean('auto_quote_id')->default(false)->after('two_factor_email_attempts');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reserved_quote_ids');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('auto_quote_id');
        });
    }
};
