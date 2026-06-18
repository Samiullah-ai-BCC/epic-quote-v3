<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = ['quote_id', 'confirmed_by', 'confirmed_at', 'total_value'];

    protected function casts(): array
    {
        return [
            'confirmed_at' => 'datetime',
            'total_value'  => 'float',
        ];
    }

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }

    public function confirmedBy()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
