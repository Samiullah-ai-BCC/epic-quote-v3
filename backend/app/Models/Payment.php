<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'quote_id', 'payment_link',
        'total_price', 'deposit_amount', 'balance_amount',
    ];

    protected function casts(): array
    {
        return [
            'total_price'    => 'float',
            'deposit_amount' => 'float',
            'balance_amount' => 'float',
        ];
    }

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }
}
