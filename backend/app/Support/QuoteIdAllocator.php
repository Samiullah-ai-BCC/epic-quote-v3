<?php

namespace App\Support;

use App\Models\Quote;
use App\Models\ReservedQuoteId;
use Illuminate\Support\Facades\DB;

/**
 * Hands out a quote ID that is free in BOTH systems.
 *
 * THE BAND. Auto-assigned IDs start at EC900000. Measured across the two ID sets on 2026-08-05:
 * the live house sequence tops out at 116714 and climbs; Airtable is still creating quotes, so a
 * band just above it (120000) would be reached after roughly 3,285 more Airtable quotes — years,
 * but not never. At 900000 the other numbering would need ~780,000 more quotes to arrive, and
 * the band is empty in both sets today. Six digits, so it still reads as an ordinary EC number.
 *
 * WHY NOT "MAX + 1" ON THIS DATABASE. It holds ~100 IDs and knows nothing of Airtable's 3,551.
 * The allocator therefore scans quotes UNION reserved_quote_ids (see the migration), which is what
 * makes "free" mean free everywhere rather than free here.
 *
 * The unique index on quotes.quote_id is the real guarantee. Two people creating a quote in the
 * same second can compute the same next number; one insert wins and the other retries. The scan is
 * an optimisation on top of that constraint, never a substitute for it.
 */
class QuoteIdAllocator
{
    public const BAND_START = 900000;
    public const BAND_END   = 999999;
    private const MAX_ATTEMPTS = 25;

    /** The next free ID in the band, as a full "EC…" string. */
    public static function next(): string
    {
        $number = self::nextNumber();
        return 'EC'.$number;
    }

    private static function nextNumber(): int
    {
        // PORTABLE ON PURPOSE. The first version did this with REGEXP + SUBSTRING + CAST, which is
        // MySQL syntax — and production runs SQLite (render.yaml), so it would have thrown
        // "no such function: REGEXP" on the first quote Rod created. The tests caught it because
        // they run on SQLite too. A LIKE prefix is understood by both, the band is small, and the
        // numeric comparison happens in PHP where it cannot depend on a dialect.
        $prefix = 'EC'.substr((string) self::BAND_START, 0, 1);   // EC9…
        $highestQuote = self::BAND_START - 1;
        foreach (DB::table('quotes')->where('quote_id', 'like', $prefix.'%')->pluck('quote_id') as $existing) {
            $id = self::normalise($existing);
            if ($id === null) continue;
            $n = (int) substr($id, 2);
            if ($n >= self::BAND_START && $n <= self::BAND_END && $n > $highestQuote) {
                $highestQuote = $n;
            }
        }

        $highestReserved = (int) ReservedQuoteId::whereBetween('number', [self::BAND_START, self::BAND_END])->max('number');

        $candidate = max($highestQuote, $highestReserved, self::BAND_START - 1) + 1;
        if ($candidate > self::BAND_END) {
            // 100,000 IDs in the band. Reaching this is not a runtime condition to paper over.
            throw new \RuntimeException('Automatic quote IDs are exhausted (EC'.self::BAND_END.'). Widen the band.');
        }
        return $candidate;
    }

    /**
     * Allocate and hand the ID to a callback that creates the quote, retrying on a collision.
     *
     * The retry exists because the gap between "read the highest" and "insert" is not atomic in any
     * database this app runs on. Rather than lock the table for every quote created, let the unique
     * index referee it and try the next number — the loser of a race is delayed by one attempt.
     */
    public static function allocate(callable $create): mixed
    {
        for ($attempt = 0; $attempt < self::MAX_ATTEMPTS; $attempt++) {
            $id = self::next();
            try {
                return $create($id);
            } catch (\Illuminate\Database\UniqueConstraintViolationException) {
                continue;   // somebody took it between the read and the insert; next number
            }
        }
        throw new \RuntimeException('Could not allocate a free quote ID after '.self::MAX_ATTEMPTS.' attempts.');
    }

    /** Normalise anything the two systems call an ID: '#EC 100187' -> 'EC100187'. Null if unusable. */
    public static function normalise(?string $raw): ?string
    {
        $v = strtoupper(trim((string) $raw));
        if (!preg_match('/^#?\s*EC\s*(\d+)$/', $v, $m)) {
            return null;
        }
        return 'EC'.ltrim($m[1], '');
    }
}
