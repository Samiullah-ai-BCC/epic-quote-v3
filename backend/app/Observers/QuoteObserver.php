<?php

namespace App\Observers;

use App\Models\Quote;
use App\Services\RevisionRecorder;

/**
 * Captures a revision on every quote create/update. Using a model observer (not scattered
 * controller calls) means a change can NEVER slip through unlogged — every ->save() is recorded.
 */
class QuoteObserver
{
    public function created(Quote $quote): void
    {
        RevisionRecorder::record($quote, auth()->user(), created: true);
    }

    // stash the OLD state before the write (getOriginal() is synced to the new values by `updated`)
    public function updating(Quote $quote): void
    {
        RevisionRecorder::remember($quote);
    }

    public function updated(Quote $quote): void
    {
        RevisionRecorder::record($quote, auth()->user());
    }
}
