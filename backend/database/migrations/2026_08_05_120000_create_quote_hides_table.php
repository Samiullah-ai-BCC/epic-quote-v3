<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user hidden quotes.
 *
 * A ROW PER (USER, QUOTE), deliberately — not a flag on `quotes`. Hiding is one rep's view of
 * their own list, not a property of the quote: Rod hiding a job must leave it exactly where it was
 * for Ed, for the quote makers, and on every admin's screen and report. A column on `quotes` would
 * make it a state of the job itself, and the first person to "clean up" their list would have
 * quietly removed work from everyone else's.
 *
 * Nothing here touches the quote. Unhiding is deleting the row, which is why the feature is
 * reversible by construction rather than by remembering to write an undo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quote_hides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quote_id')->constrained('quotes')->cascadeOnDelete();
            $table->timestamps();
            // One hide per person per quote — hiding twice is the same as hiding once, so the
            // endpoint can be safely retried and a double-click cannot create a second row.
            $table->unique(['user_id', 'quote_id']);
            // The listing asks "which quotes has THIS user hidden" on every page load.
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_hides');
    }
};
