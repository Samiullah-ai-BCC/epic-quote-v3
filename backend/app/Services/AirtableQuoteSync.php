<?php

namespace App\Services;

use App\Models\Quote;
use App\Models\Setting;
use App\Models\UserCatalogItem;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Two-way sync with the team's Airtable base ("Business sign-Epic Craftings USA Project").
 * Scope per Sami: the `Quotes- working` table (the quote→client journey) + `Side Views`.
 *
 * Zero-desync rules:
 *  - Every pulled record keeps its FULL raw Airtable fields in generated_data['airtable_raw']
 *    (lossless — nothing is abstracted away even when it has no estimator column yet).
 *  - The 47-option Status field is decomposed into its five real jobs:
 *      real status → quote.status ; people → assigned_to / sales_rep ;
 *      Rush/Super Rush → rush ; approval guards → approval_locked ;
 *      everything unmappable → generated_data['airtable_status_extra'].
 *  - Sync key = airtable_id (recXXXX). Upserts never duplicate.
 *
 * Env: AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_QUOTES_TABLE, AIRTABLE_SIDEVIEWS_TABLE.
 */
class AirtableQuoteSync
{
    // ---- Status decomposition (exact option names from the 2026-07-03 tour) ----
    private const STATUS_MAP = [
        'Done'                              => 'Done',
        'In progress'                       => 'In Progress',
        'To Do'                             => 'To Do',
        'Quote Approval Needed'             => 'Quote Approval Needed',
        'Need To Share with Customer '      => 'Need To Share With Customer',
        'No Response from Client'           => 'Awaiting Customer Response',
        'waiting for client response'       => 'Awaiting Customer Response',
        'need to reply rod '                => 'Awaiting Rod Response',
        'waiting for rod reply'             => 'Awaiting Rod Response',
        'NEED TO SHARE WITH ROD'            => 'Awaiting Rod Response',
        'Need to share with sir sami'       => 'Awaiting Sir Sami Response',
        'waiting for Sami sir reply'        => 'Awaiting Sir Sami Response',
        'review quote by sir sami'          => 'Awaiting Sir Sami Response',
        'Artwork needs to be Added'         => 'Artwork Needed',
        'artwork send to client for approval' => 'Artwork Needed',
        'Need to embed payment link'        => 'Need Payment Link Sent',
        'Revision needed'                   => 'In Progress',
    ];
    // pick the primary status by this precedence when a record carries several
    private const STATUS_PRECEDENCE = [
        'Done', 'Need Payment Link Sent', 'Quote Approval Needed', 'Need To Share With Customer',
        'Awaiting Customer Response', 'Awaiting Rod Response', 'Awaiting Sir Sami Response',
        'Artwork Needed', 'In Progress', 'To Do',
    ];
    private const PEOPLE = ['Faraz Awan', 'khola', 'khansa', 'alishan', 'mussawer', 'yasir', 'Usman Altaf'];
    private const MANAGERS = ['Rod' => 'Rod Muffet', 'Ed Weikle' => 'Ed Weikle'];
    private const GUARDS = [
        "Don't Work or Share with Anyone without Faraz's Approval",
        "Do not send without Faraz's approval",
    ];

    public static function configured(): bool
    {
        return (bool) (env('AIRTABLE_API_KEY') && env('AIRTABLE_BASE_ID') && env('AIRTABLE_QUOTES_TABLE'));
    }

    private static function client(): Client
    {
        return new Client([
            'base_uri' => 'https://api.airtable.com/v0/'.env('AIRTABLE_BASE_ID').'/',
            'timeout'  => 60,
            'headers'  => ['Authorization' => 'Bearer '.env('AIRTABLE_API_KEY')],
        ]);
    }

    /** Pull every Quotes-working record and upsert as estimator quotes. Returns [created, updated, skipped]. */
    public static function importQuotes(?callable $progress = null): array
    {
        $created = 0; $updated = 0; $skipped = 0;
        $offset = null;
        do {
            $query = ['pageSize' => 100];
            if ($offset) $query['offset'] = $offset;
            $res = json_decode((string) self::client()->get(rawurlencode(env('AIRTABLE_QUOTES_TABLE')), ['query' => $query])->getBody(), true);
            foreach ($res['records'] ?? [] as $rec) {
                $result = self::upsertFromRecord($rec);
                ${$result}++;
                if ($progress) $progress($created + $updated + $skipped);
            }
            $offset = $res['offset'] ?? null;
        } while ($offset);

        // continue our EC counter past theirs so new estimator quotes never collide
        $max = (int) Quote::whereRaw("quote_id LIKE 'EC%'")->selectRaw("MAX(CAST(SUBSTR(quote_id,3) AS INTEGER)) as m")->value('m');
        if ($max > (int) Setting::get('quote_counter', '100000')) {
            Setting::put('quote_counter', (string) $max);
        }
        return [$created, $updated, $skipped];
    }

    /** Map one Airtable record → estimator quote. Returns 'created' | 'updated' | 'skipped'. */
    public static function upsertFromRecord(array $rec): string
    {
        $f = $rec['fields'] ?? [];
        $statuses = (array) ($f['Status'] ?? []);

        // decompose the status pile
        $primary = null;
        $mapped = [];
        foreach ($statuses as $s) {
            if (isset(self::STATUS_MAP[$s])) $mapped[] = self::STATUS_MAP[$s];
        }
        foreach (self::STATUS_PRECEDENCE as $p) {
            if (in_array($p, $mapped, true)) { $primary = $p; break; }
        }
        $assigned = collect($statuses)->first(fn ($s) => in_array($s, self::PEOPLE, true)) ?? '';
        $rushFlag = in_array('Super Rush', $statuses, true) ? 'super_rush' : (in_array('Rush', $statuses, true) ? 'rush' : '');
        $locked = (bool) array_intersect(self::GUARDS, $statuses);
        $extras = array_values(array_filter($statuses, fn ($s) => !isset(self::STATUS_MAP[$s])
            && !in_array($s, self::PEOPLE, true) && !in_array($s, ['Rush', 'Super Rush'], true)
            && !in_array($s, self::GUARDS, true) && !isset(self::MANAGERS[$s])));
        $manager = collect($statuses)->first(fn ($s) => isset(self::MANAGERS[$s]));

        $quoteId = trim((string) ($f['Quote ID'] ?? ''));
        $payLink = trim((string) ($f['Payment link'] ?? ''));

        $attrs = [
            'quote_id'      => $quoteId !== '' ? $quoteId : 'AT-'.substr($rec['id'], 3, 10),
            'job_name'      => trim((string) ($f['Name'] ?? '')),
            'company_name'  => trim((string) ($f['Company Name'] ?? '')),
            'contact'       => trim((string) ($f['Email'] ?? '')),
            'sales_rep'     => trim((string) ($f['Account Manager'] ?? '')) ?: (self::MANAGERS[$manager] ?? ''),
            'status'        => $primary ?? 'To Do',
            'price'         => is_numeric($f['Final Price'] ?? null) ? min(10000000, max(0, (float) $f['Final Price'])) : 0,
            'breakeven_production' => is_numeric($f['Breakeven Production (USD)-Proposal'] ?? null) ? (float) $f['Breakeven Production (USD)-Proposal'] : null,
            'breakeven_shipping'   => is_numeric($f['Breakeven Shipping (USD)-Proposal'] ?? null) ? (float) $f['Breakeven Shipping (USD)-Proposal'] : null,
            'price_approved'=> (bool) ($f['Price Approved'] ?? false),
            'approved_by'   => trim((string) ($f['Approved By:'] ?? '')),
            'approval_locked' => $locked,
            'assigned_to'   => $assigned,
            'rush'          => $rushFlag,
            'followup_sent' => (bool) ($f['Follow up Sent'] ?? ($f['Quote Followup Sent?'] ?? false)),
            'followup_notes'=> trim((string) ($f['Follow up Notes'] ?? '')) ?: null,
            'quote_source'  => implode(', ', (array) ($f['Quote Received Via'] ?? [])),
            'special_requirements' => trim((string) ($f['Special Notes'] ?? '')),
        ];

        $quote = Quote::where('airtable_id', $rec['id'])->first()
            // second chance: match by their "Secondary Portal Quote ID" = our quote_id
            ?? (($sec = trim((string) ($f['Secondary Portal Quote ID'] ?? ''))) !== '' ? Quote::where('quote_id', $sec)->first() : null);

        $gdPatch = [
            'airtable_raw'          => $f,        // LOSSLESS copy — rule 5
            'airtable_status_extra' => $extras,
            'airtable_synced_at'    => now()->toIso8601String(),
        ];
        if ($payLink !== '' && preg_match('#^https?://\S+\.\S+#i', $payLink)) {
            $gdPatch['payment_link'] = $payLink;
        }
        if (!empty($f['Dimensions'])) {
            $gdPatch['airtable_dimensions'] = $f['Dimensions'];
        }

        if ($quote) {
            $gd = array_merge($quote->generated_data ?? [], $gdPatch);
            unset($attrs['quote_id']); // never rewrite an existing estimator id
            $quote->fill($attrs + ['airtable_id' => $rec['id'], 'generated_data' => $gd])->save();
            return 'updated';
        }
        // avoid id collisions with pre-existing estimator quotes
        if (Quote::whereRaw('UPPER(quote_id) = ?', [strtoupper($attrs['quote_id'])])->exists()) {
            $attrs['quote_id'] .= '-AT';
        }
        Quote::create($attrs + [
            'airtable_id'    => $rec['id'],
            'quote_num'      => 0,
            'order_id'       => '',
            'generated_data' => $gdPatch,
            'created_at'     => $rec['createdTime'] ?? now(),
        ]);
        return 'created';
    }

    /** Push an estimator quote's core fields back to its Airtable row (parallel-run mirror). */
    public static function pushQuote(Quote $quote): void
    {
        if (!self::configured()) return;
        try {
            $fields = [
                'Quote ID'                  => $quote->quote_id,
                'Secondary Portal Quote ID' => $quote->quote_id,
                'Name'                      => (string) $quote->job_name,
                'Company Name'              => (string) $quote->company_name,
                'Final Price'               => (float) $quote->price,
                'Price Approved'            => (bool) $quote->price_approved,
                'Follow up Sent'            => (bool) $quote->followup_sent,
            ];
            if ($quote->airtable_id) {
                self::client()->patch(rawurlencode(env('AIRTABLE_QUOTES_TABLE')).'/'.$quote->airtable_id, ['json' => ['fields' => $fields]]);
            } else {
                $res = json_decode((string) self::client()->post(rawurlencode(env('AIRTABLE_QUOTES_TABLE')), ['json' => ['fields' => $fields, 'typecast' => true]])->getBody(), true);
                if (!empty($res['id'])) $quote->forceFill(['airtable_id' => $res['id']])->saveQuietly();
            }
        } catch (\Throwable $e) {
            Log::warning("Airtable pushQuote {$quote->quote_id}: ".$e->getMessage());
        }
    }

    /** Import the Side Views library: download each attachment, store permanently, add to the team catalog. */
    public static function importSideViews(?callable $progress = null): array
    {
        $added = 0; $skipped = 0;
        $offset = null;
        do {
            $query = ['pageSize' => 100];
            if ($offset) $query['offset'] = $offset;
            $res = json_decode((string) self::client()->get(rawurlencode(env('AIRTABLE_SIDEVIEWS_TABLE', 'Side Views')), ['query' => $query])->getBody(), true);
            foreach ($res['records'] ?? [] as $rec) {
                $f = $rec['fields'] ?? [];
                $name = strtoupper(trim((string) ($f['Sign Type Detail'] ?? '')));
                $atts = (array) ($f['Side View- PNGs/Pdfs'] ?? []);
                if ($name === '' || !$atts) { $skipped++; continue; }
                if (UserCatalogItem::where('kind', 'side_view')->where('name', $name)->exists()) { $skipped++; continue; }
                // prefer a PNG; fall back to the first attachment (Cloudinary rasterizes PDFs)
                $att = collect($atts)->first(fn ($a) => str_contains((string) ($a['type'] ?? ''), 'image')) ?? $atts[0];
                $tmp = tempnam(sys_get_temp_dir(), 'sv');
                try {
                    file_put_contents($tmp, file_get_contents($att['url']));
                    $path = null;
                    if (CloudinaryService::configured()) {
                        $path = CloudinaryService::upload($tmp, 'epic-quote/library', 'auto');
                        // PDFs render as page-1 PNG via the CDN transform
                        if ($path && preg_match('#\.(pdf|ai)$#i', $path)) {
                            $path = preg_replace('#/upload/#', '/upload/pg_1,f_png,w_1200/', $path, 1);
                            $path = preg_replace('#\.(pdf|ai)$#i', '.png', $path);
                        }
                    }
                    if (!$path) {
                        $fn = 'lib_'.substr(md5($name), 0, 8).'_'.preg_replace('/[^A-Za-z0-9._-]/', '_', (string) ($att['filename'] ?? 'sideview.png'));
                        Storage::disk('public')->put("library/{$fn}", file_get_contents($tmp));
                        $path = "/storage/library/{$fn}";
                    }
                    UserCatalogItem::create(['kind' => 'side_view', 'name' => mb_substr($name, 0, 160), 'data' => [
                        'path'     => $path,
                        'category' => $f['Sign Type :)']['name'] ?? ($f['Sign Type :)'] ?? null),
                        'material' => $f['Material Thickness'] ?? null,
                        'mounting' => $f['Mounting'] ?? null,
                        'backer'   => $f['Backer Thickness'] ?? null,
                        'airtable_id' => $rec['id'],
                    ]]);
                    $added++;
                } catch (\Throwable $e) {
                    Log::warning("Side view import '{$name}': ".$e->getMessage());
                    $skipped++;
                } finally {
                    @unlink($tmp);
                }
                if ($progress) $progress($added + $skipped);
            }
            $offset = $res['offset'] ?? null;
        } while ($offset);
        return [$added, $skipped];
    }
}
