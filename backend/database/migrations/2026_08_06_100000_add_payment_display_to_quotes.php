<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which payment instructions a quote's proposal prints: the Shopify pay button, the company's
 * bank details, or both. Shopify takes 3% of every quote paid through it, so aWire is
 * often the preferred route — but it is the rep's call, per quote.
 *
 * NULLABLE WITH NO DEFAULT, DELIBERATELY. Every quote already in the system has no value, and
 * NULL has to mean "Shopify only" — exactly what those quotes do today. Backfilling a value here
 * would be rewriting the behaviour of live quotes to make a new column look tidy.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('payment_display', 16)->nullable()->after('payment_link');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn('payment_display');
        });
    }
};
