<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * V1 key/value settings table. Holds quote_counter, order_counter, company logo path, etc.
 */
class Setting extends Model
{
    protected $primaryKey = 'key';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['key', 'value'];

    public static function get(string $key, ?string $default = null): ?string
    {
        return static::find($key)?->value ?? $default;
    }

    public static function put(string $key, string $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    // V1 next_quote_id(): EC{counter}, increments before use
    public static function nextQuoteId(): array
    {
        $counter = (int) static::get('quote_counter', '100000') + 1;
        static::put('quote_counter', (string) $counter);
        return [$counter, "EC{$counter}"];
    }

    // V1 next_order_id(): ORD-{counter}
    public static function nextOrderId(): string
    {
        $counter = (int) static::get('order_counter', '100000') + 1;
        static::put('order_counter', (string) $counter);
        return "ORD-{$counter}";
    }
}
