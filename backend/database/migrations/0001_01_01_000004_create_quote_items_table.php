<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// V3 NEW (N1): normalized 1→N items per quote.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quote_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_id')->constrained('quotes')->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->string('sign_type', 200)->nullable();       // verbatim from catalog
            $table->string('description', 300)->default('');
            $table->string('dimensions', 120)->default('');
            $table->string('returns', 120)->default('');
            $table->string('trimcap', 120)->default('');
            $table->string('mounting', 120)->default('');
            $table->string('illumination', 120)->default('');
            $table->string('face_color', 120)->default('');
            $table->string('return_color', 120)->default('');
            $table->string('application', 120)->default('');
            $table->text('spec_text')->nullable();              // custom free-form spec (#70)
            $table->text('notes')->nullable();
            $table->float('price')->default(0);
            $table->timestamps();

            $table->index('quote_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_items');
    }
};
