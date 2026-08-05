<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One rep's decision to keep a quote out of their own All Quotes list.
 *
 * Presentation only. It changes no field on the quote, so status, price, approval and history are
 * exactly as they were, and every other user's list is untouched. Deleting the row unhides.
 */
class QuoteHide extends Model
{
    protected $fillable = ['user_id', 'quote_id'];
}
