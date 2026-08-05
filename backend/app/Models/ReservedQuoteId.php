<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A quote ID that is in use in ANOTHER system (Airtable today) and must never be handed out here.
 * Not a quote: no customer, no price, no history, and it appears in no list, report or total.
 */
class ReservedQuoteId extends Model
{
    protected $fillable = ['quote_id', 'number', 'source'];
}
