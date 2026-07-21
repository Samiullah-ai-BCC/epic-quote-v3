<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * DB-backed mirror of the FA sign-type mapping (frontend/src/generator/faCatalogData.js).
 * The frontend is the live source the wizard actually reads — this table exists so the
 * mapping ships WITH the database (portable to devs via the same dump/seed the app already
 * uses) and is inspectable/queryable outside the JS bundle. Seeded from the same verbatim
 * sheet data — see SignCatalogSeeder + database/data/fa_sign_catalog.json.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sign_catalog_entries', function (Blueprint $table) {
            $table->id();
            $table->string('family');
            $table->string('sign_type');
            $table->string('thickness')->nullable();   // e.g. 1/4" — only flat-cut letters use this
            $table->string('mounting')->nullable();     // e.g. Raceway Mount (2") — null for single-option types
            $table->string('package', 8)->nullable();   // A/B/C/D — which package artwork to show
            $table->string('sideview')->nullable();     // side-view image key (blank until supplied)
            $table->json('lines');                      // parsed verbatim spec template (see faCatalog.js)
            $table->timestamps();

            $table->index(['family', 'sign_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sign_catalog_entries');
    }
};
