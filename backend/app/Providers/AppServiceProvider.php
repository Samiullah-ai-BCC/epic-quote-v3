<?php

namespace App\Providers;

use App\Models\Quote;
use App\Observers\QuoteObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // field-level revision history for every quote change
        Quote::observe(QuoteObserver::class);
    }
}
