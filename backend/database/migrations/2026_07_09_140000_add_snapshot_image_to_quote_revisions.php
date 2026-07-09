<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quote_revisions', function (Blueprint $table) {
            // Rendered proposal image (Cloudinary URL or /storage path) captured at this version,
            // so the history shows the ACTUAL proposal as it looked, not just a field diff.
            $table->string('snapshot_image')->nullable()->after('snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('quote_revisions', function (Blueprint $table) {
            $table->dropColumn('snapshot_image');
        });
    }
};
