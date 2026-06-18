<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * V3 NEW (N1): multi-item quotes. V1 stored a single item inside generated_data JSON;
 * V3 normalizes 1→N items per quote. Columns mirror the AI spec schema (#77) plus
 * custom-spec free text (#70). Full editor layout still lives in quotes.generated_data.
 */
class QuoteItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'quote_id', 'position',
        'sign_type', 'description', 'dimensions',
        'returns', 'trimcap', 'mounting', 'illumination',
        'face_color', 'return_color', 'application',
        'spec_text', 'notes', 'price',
    ];

    protected function casts(): array
    {
        return [
            'price'    => 'float',
            'position' => 'integer',
        ];
    }

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }
}
