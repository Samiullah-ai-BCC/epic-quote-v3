<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Airtable parity (T12, T13): three separate note lanes so nothing gets buried in one
// blob — revision asks, things the team must not miss, and internal-only chatter —
// plus a real "order placed" timestamp (order_confirmed alone can't say WHEN).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->text('revision_notes')->nullable();
            $table->text('important_notes')->nullable();
            $table->text('internal_notes')->nullable();
            $table->timestamp('order_placed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn(['revision_notes', 'important_notes', 'internal_notes', 'order_placed_at']);
        });
    }
};
