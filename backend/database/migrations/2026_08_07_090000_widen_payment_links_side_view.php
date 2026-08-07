<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `payment_links.side_view` was declared VARCHAR(255) and has been holding longer values than that
 * in production for months — the longest is 308 characters.
 *
 * It went unnoticed because production runs SQLite, which treats a column's declared length as
 * documentation rather than a constraint: `varchar(255)` accepts a megabyte. MySQL enforces it, so
 * the overflow only became visible when the data was copied to MySQL, where it aborts the insert
 * with "Data too long for column 'side_view'".
 *
 * Widened to 1024 rather than to exactly 308: the column holds a sign's dimensions/side-view
 * reference, which grows with the spec text, and re-hitting this on the next long entry would be
 * the same bug a second time. TEXT would be the other option, but it cannot be indexed as cheaply
 * and nothing here needs unbounded length.
 *
 * A scan of every other varchar column against the production data found no further overflows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_links', function (Blueprint $table) {
            $table->string('side_view', 1024)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Deliberately not narrowing back to 255: real rows already exceed it, so the reverse
        // migration would truncate live data. Leaving the column wide is the safe inverse.
    }
};
