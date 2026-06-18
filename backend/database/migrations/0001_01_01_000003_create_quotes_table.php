<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('quote_id', 20)->unique();          // EC{counter}
            $table->string('order_id', 50)->default('');        // ORD-{counter}
            $table->unsignedInteger('quote_num')->unique();     // integer counter
            $table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('company_name', 200)->nullable();
            $table->string('client_name', 120)->nullable();
            $table->string('contact', 200)->default('');
            $table->text('address')->nullable();
            $table->string('job_name', 200)->default('');
            $table->text('special_requirements')->nullable();
            $table->string('customer_pdf', 300)->nullable();
            $table->string('sales_rep', 50)->nullable();
            $table->string('quote_source', 50)->nullable();
            $table->string('status', 50)->default('To Do');
            $table->json('tags')->nullable();                   // V1 stored JSON string '[]'
            $table->float('price')->default(0);
            $table->string('quote_type', 20)->nullable();       // 'generator' | 'custom'
            $table->longText('generated_data')->nullable();     // full editor state JSON (#19)
            $table->string('crunched_artwork', 300)->default('');
            $table->string('payment_link', 500)->default('');
            $table->boolean('order_confirmed')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('final_created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index('sales_rep');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
