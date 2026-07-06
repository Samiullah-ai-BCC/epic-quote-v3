<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Quotes-working (Airtable) parity: the fields the quote team lives by that the
// estimator lacked, plus the sync key for two-way synchronization.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('airtable_id', 32)->nullable()->index();      // recXXXX — the sync key
            $table->string('assigned_to', 120)->default('');             // who works the quote (was "people as statuses")
            $table->string('rush', 16)->default('');                     // '' | 'rush' | 'super_rush'
            $table->decimal('breakeven_production', 12, 2)->nullable();  // Breakeven Production (USD)-Proposal
            $table->decimal('breakeven_shipping', 12, 2)->nullable();    // Breakeven Shipping (USD)-Proposal
            $table->boolean('price_approved')->default(false);
            $table->string('approved_by', 120)->default('');
            $table->boolean('approval_locked')->default(false);          // "don't share without approval" as a REAL gate
            $table->boolean('followup_sent')->default(false);
            $table->text('followup_notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn([
                'airtable_id', 'assigned_to', 'rush', 'breakeven_production', 'breakeven_shipping',
                'price_approved', 'approved_by', 'approval_locked', 'followup_sent', 'followup_notes',
            ]);
        });
    }
};
