<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Field-level revision history for quotes (Airtable-style). Every save records the per-field
 * diff (incl. deep proposal edits like an image crop) + a full snapshot for restore, with the
 * user and time. Portable across SQLite → Postgres (only json + standard column types).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quote_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('user_id')->nullable();   // who made the change
            $table->string('user_name')->nullable();             // denormalized → survives user deletion
            // named field_changes (NOT "changes") — Eloquent has an internal $changes property
            $table->json('field_changes');                       // [{field,label,old,new}] human-readable diff
            $table->json('snapshot');                            // full state at this version (for restore)
            $table->timestamp('created_at')->nullable();
            $table->index(['quote_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_revisions');
    }
};
