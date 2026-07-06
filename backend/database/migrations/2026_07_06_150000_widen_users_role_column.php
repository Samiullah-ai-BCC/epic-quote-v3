<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The original enum() baked a CHECK constraint (admin/sales_rep/manager) into SQLite.
// Roles now come from AppConstants::ROLES (adds account_manager/quote_maker/viewer),
// so the column becomes a plain string — validation lives in the app layer.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('sales_rep')->change();
        });
    }

    public function down(): void
    {
        // no-op: restoring the CHECK would break rows already using the new roles
    }
};
