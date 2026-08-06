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

    /**
     * The EFFECTIVE quote-status list (#16): admin-managed via settings, falling back to the V1
     * defaults. Every consumer (constants endpoint, dashboard buckets, status/tags validation)
     * reads THIS — never AppConstants::STATUS_OPTIONS directly — so an admin edit applies
     * everywhere at once. Existing quotes keep their old status string even when it's removed
     * from the list; the UI shows it as-is.
     */
    public static function statusOptions(): array
    {
        $raw = static::get('status_options');
        if ($raw) {
            $list = json_decode($raw, true);
            if (is_array($list) && $list !== []) {
                $clean = array_values(array_filter(array_map(fn ($s) => trim((string) $s), $list), fn ($s) => $s !== ''));
                if ($clean !== []) {
                    return $clean;
                }
            }
        }
        return \App\Constants\AppConstants::STATUS_OPTIONS;
    }

    /**
     * The company's wire-transfer details, printed on the proposal as an alternative to the
     * Shopify pay button (Shopify takes 3% of every quote paid through it).
     *
     * Five discrete fields, not one blob of text: an admin correcting the account number cannot
     * break the sheet's layout while doing it, and the bold-label styling belongs to the proposal
     * rather than to whatever a human retyped this time.
     *
     * Always returns all five keys, so no caller has to guess whether a field exists. Empty
     * strings mean "not set yet" — the proposal prints NOTHING rather than a half-filled block,
     * because wrong-looking payment instructions on a customer's proposal are worse than none.
     */
    public const BANK_FIELDS = ['title', 'account_number', 'routing_number', 'routing_note', 'address'];

    public static function bankDetails(): array
    {
        $saved = json_decode((string) static::get('bank_details'), true);
        $saved = is_array($saved) ? $saved : [];
        $out = [];
        foreach (self::BANK_FIELDS as $field) {
            $out[$field] = trim((string) ($saved[$field] ?? ''));
        }
        return $out;
    }

    // V1 next_quote_id(): EC{counter}, increments before use.
    // When Airtable is configured (the team's other software also numbers quotes there),
    // continue past Airtable's highest ID so the two systems never hand out the same number.
    public static function nextQuoteId(): array
    {
        $counter = (int) static::get('quote_counter', '100000');
        $counter = max($counter, \App\Services\AirtableService::maxQuoteNumber()) + 1;
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
