<?php

namespace App\Services;

use App\Models\Quote;
use Illuminate\Support\Facades\Http;

/**
 * Creates the exact "unlisted product" the team makes by hand in Shopify, from a quote.
 * Dormant until SHOPIFY_STORE_DOMAIN + SHOPIFY_API_TOKEN are set (like CloudinaryService).
 *
 * Product mapping (locked with Sami):
 *   title      = "{Quote ID} - {Item Description}"
 *   vendor     = "EpicCraftings"
 *   type       = the sign type
 *   image      = the clean proposal preview (no price block)
 *   status     = active + published to Online Store (their "unlisted": reachable by link,
 *                not added to any collection/menu)
 *   inventory  = US location, qty 1 (tracked)
 *   variants   = Full Payment, and 50% Deposit — EXCEPT when the total is <= $500, where
 *                only Full Payment is offered. Balance is generated later as its own link.
 * We send the customer the product-page link.
 */
class ShopifyService
{
    public static function configured(): bool
    {
        return !empty(self::domain()) && !empty(config('services.shopify.token'));
    }

    /** Normalized store host, e.g. "my-store.myshopify.com" — tolerates a pasted URL/slash. */
    public static function domain(): ?string
    {
        $d = trim((string) config('services.shopify.domain'));
        if ($d === '') {
            return null;
        }
        $d = preg_replace('#^https?://#i', '', $d);   // drop protocol
        $d = explode('/', $d)[0];                      // drop any path
        return $d ?: null;
    }

    /** Customer-facing storefront host for product links: the configured custom domain
     *  (e.g. epiccraftings.com) if set, else the myshopify store domain. Using the custom
     *  domain avoids the slow .myshopify.com → custom-domain redirect (#10). */
    public static function storefrontHost(): ?string
    {
        $s = trim((string) config('services.shopify.storefront_domain'));
        if ($s !== '') {
            $s = preg_replace('#^https?://#i', '', $s);
            $s = explode('/', $s)[0];
            if ($s !== '') {
                return $s;
            }
        }
        return self::domain();
    }

    /** Full amount at or below this → full payment only (no 50% deposit option). */
    public const FULL_ONLY_MAX = 500.0;

    /**
     * Build the REST product payload (pure — no network, unit-testable).
     * $kind: 'quote' (Full + Deposit variants), or 'balance' (single Balance variant).
     */
    /**
     * @param string|array|null $images   one clean-image data URL, or an ARRAY of them (one per
     *                                     sign on a multi-page quote — all attach to the product).
     * @param string|null       $titleOverride  combined title for a multi-sign quote
     *                                     ("A & B FOR Company"); null → the single-sign default.
     */
    public static function buildProductPayload(Quote $quote, float $total, string|array|null $images, string $kind = 'full', ?string $titleOverride = null): array
    {
        $gd = $quote->generated_data ?: [];
        $itemDesc = $gd['custom_spec']['itemDesc'] ?? $quote->job_name ?: 'CUSTOM SIGNAGE';
        $signType = $gd['tpl_name'] ?? ($gd['custom_spec']['signType'] ?? '');

        $variants = self::variantsFor($total, $kind);
        // title: multi-sign quotes pass a combined title; single-sign uses the classic
        // "{ID} - {Title Case item} - {Payment part}" (#1, #4).
        $baseTitle = $titleOverride !== null && trim($titleOverride) !== ''
            ? self::titleCase(trim($titleOverride))
            : self::titleCase($itemDesc);
        $title = self::fitTitle($quote->quote_id, $baseTitle, self::kindLabel($kind), $gd);

        // Category (#3): "LED Signs" if ANY sign is illuminated/LED, else "Business Signs". The
        // true Shopify standard-category column is a taxonomy field REST can't set — we put the
        // label in a tag (so it's visible/filterable) and set product_type per the team's rule.
        $category = self::signCategory($gd, $signType);

        $product = [
            'title'          => $title,
            // Show the sign SPECS beneath the "Pay now" CTA (#9), not a bare sign-type tag.
            'body_html'      => self::specsHtml($gd, $signType),
            'vendor'         => 'EpicCraftings',
            'product_type'   => 'Custom Business Signs',   // always, per the team's convention (#3)
            'status'         => 'active',                 // purchasable
            'published_scope' => 'web',                   // Online Store
            'tags'           => 'estimator,'.$quote->quote_id.','.$kind.','.$category,
            // random handle suffix → the URL is unguessable (privacy): someone can't just
            // increment the quote number to find another customer's link.
            // Shopify caps the handle at 255 too, and it is DERIVED from the title — which is why a
            // long multi-sign title produced TWO "is too long" errors, not one. The random suffix is
            // what makes the URL unguessable, so it is kept and the slug yields the space.
            'handle'         => self::fitHandle($title),
            'variants'       => $variants,
        ];

        // one image per sign — Shopify shows them all in the product gallery. Base64 "attachment"
        // (strip any data: URI prefix). Empty / malformed entries are skipped, not sent.
        $attachments = [];
        foreach ((array) $images as $img) {
            if (is_string($img) && $img !== '') {
                $attachments[] = ['attachment' => preg_replace('#^data:image/\w+;base64,#', '', $img)];
            }
        }
        if ($attachments) {
            $product['images'] = $attachments;
        }

        return ['product' => $product];
    }

    /** ONE variant matching the payment kind — so the product's price IS what the rep chose
     *  (full → full price, deposit/balance → half). No more multi-variant products defaulting
     *  to the cheapest option (#2). */
    public static function variantsFor(float $total, string $kind = 'full'): array
    {
        $price = fn ($n) => number_format(round($n, 2), 2, '.', '');
        $base = [
            // Track inventory and keep exactly ONE in stock (team convention): the link shows
            // "1 in stock" and is a one-time purchase. The quantity itself is set at the US
            // location AFTER create (see setInventoryOne) — REST no longer accepts it inline.
            'inventory_management' => 'shopify',
            'inventory_policy'     => 'deny',
            // NOT A PARCEL. This variant is a PAYMENT for a sign, not the sign — Epic ships the sign
            // itself, outside Shopify, and nothing in this codebase ever reads a shipping address off
            // a Shopify order.
            //
            // While this was `true`, Shopify treated every payment link as a shippable good and
            // demanded a shipping RATE covering the customer's address before it would let them pay.
            // With no zone/rate matching that address the checkout dead-ends on two red boxes —
            // "The products in your cart are not available for delivery to your location" and
            // "Shipping not available" — with a perfectly valid address typed in. That is not an
            // address problem and no amount of retyping fixes it: the customer simply cannot pay.
            // (Reported 2026-07-30 on a live $23,000 checkout with the company's own Philadelphia
            // address, which the whole team had been using by hand.)
            //
            // `false` removes the shipping step from the checkout entirely, so this class of failure
            // cannot happen again for ANY address or country — it does not depend on the store's
            // shipping zones being configured correctly. Card payments still collect a billing
            // address, so nothing needed for the charge is lost.
            'requires_shipping'    => false,
            'taxable'              => true,
        ];
        $amount = $kind === 'full' ? $total : $total / 2;
        // No option1 → Shopify uses the default variant, so the storefront shows NO "Full Payment"
        // selector tag. The payment kind already lives in the product title.
        return [['price' => $price($amount)] + $base];
    }

    /**
     * The US WAREHOUSE's location id — the one the team stocks payment links at, by name.
     *
     * It used to be `locations.json?limit=1`, commented "primary (US) location", which was simply an
     * assumption: Shopify returns locations in ITS order, and this store has three (france warehouse,
     * NY Warehouse, US Warehouse). Asking for one got whichever came first — NY — so every link was
     * stocked at, or failed against, the wrong warehouse.
     * Name match is deliberate over "first": a location list can grow at any time, and the team's rule
     * is about the US warehouse specifically. Override with SHOPIFY_LOCATION_NAME if it is ever
     * renamed; falls back to any name containing "us", then to the first active location, so a store
     * with one nameless location still works.
     */
    public static function usLocationId(): ?string
    {
        if (!self::configured()) {
            return null;
        }
        // An explicit id wins: it is exact and survives a rename. (This setting already existed and
        // was never read — the lookup below was doing all the work, badly.)
        $explicit = trim((string) config('services.shopify.location_id', ''));
        if ($explicit !== '') {
            return $explicit;
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        try {
            $resp = Http::timeout(15)->withHeaders(['X-Shopify-Access-Token' => config('services.shopify.token')])
                ->get("https://{$domain}/admin/api/{$version}/locations.json");
            if (!$resp->successful()) {
                return null;
            }
        } catch (\Throwable) {
            return null;
        }
        $locations = collect($resp->json('locations') ?? [])->filter(fn ($l) => ($l['active'] ?? true));
        $wanted = strtolower(trim((string) (config('services.shopify.location_name') ?: 'US Warehouse')));
        // "us" must be matched as a WORD. A plain str_contains matched "france warehoUSe" — every
        // warehouse contains those two letters, so the fallback would have picked France.
        $isUs = function ($l) {
            $name = strtolower((string) ($l['name'] ?? ''));
            $words = preg_split('/[^a-z]+/', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            return in_array('us', $words, true) || in_array('usa', $words, true)
                || str_contains($name, 'united states');
        };
        $byName = $locations->first(fn ($l) => strtolower(trim((string) ($l['name'] ?? ''))) === $wanted)
            ?? $locations->first($isUs)
            ?? $locations->first();
        return $byName ? (string) $byName['id'] : null;
    }

    /**
     * Stock the variant with exactly 1 at the US warehouse (the team's convention: the link reads
     * "1 in stock" and is a one-time purchase). Called right after createProduct. Returns true only
     * when Shopify confirms the level. On failure the caller untracks the variant so the link can
     * never become an unpayable "sold out" — safe, but it is a FALLBACK, and every product in the
     * store showing "Inventory not tracked" is one of these failures, not a choice.
     */
    public static function setInventoryOne(string $inventoryItemId): bool
    {
        if (!self::configured() || $inventoryItemId === '') {
            return false;
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        $headers = ['X-Shopify-Access-Token' => config('services.shopify.token'), 'Content-Type' => 'application/json'];
        $locationId = self::usLocationId();
        if (!$locationId) {
            return false;
        }
        $setLevel = function () use ($domain, $version, $headers, $locationId, $inventoryItemId) {
            return Http::timeout(15)->withHeaders($headers)
                ->post("https://{$domain}/admin/api/{$version}/inventory_levels/set.json", [
                    'location_id'       => $locationId,
                    'inventory_item_id' => $inventoryItemId,
                    'available'         => 1,
                ]);
        };
        try {
            $set = $setLevel();
            if ($set->successful()) {
                return true;
            }
            // A brand-new variant is only STOCKED AT the store's default location, so setting a level
            // at any other one answers 404/422 ("inventory item does not have an inventory level at
            // this location"). That was the whole failure: set → refused → caller untracks → the
            // product reads "Inventory not tracked" and lists the default warehouse. Connect the item
            // to the location first, then set. Connecting an already-connected item is harmless.
            Http::timeout(15)->withHeaders($headers)
                ->post("https://{$domain}/admin/api/{$version}/inventory_levels/connect.json", [
                    'location_id'       => $locationId,
                    'inventory_item_id' => $inventoryItemId,
                ]);
            return $setLevel()->successful();
        } catch (\Throwable) {
            return false;
        }
    }


    /** Flip a product to the "Unlisted" status (#1): sellable via its direct link but hidden from
     *  search / collections / channels. This status only exists in GraphQL (ProductStatus.UNLISTED)
     *  — REST's status enum is active/draft/archived — so we PATCH it right after the REST create.
     *  Best-effort: on failure the product stays Active (still payable), just listed. */
    public static function setUnlisted(string $productId): bool
    {
        if (!self::configured() || $productId === '') {
            return false;
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        $gid = 'gid://shopify/Product/'.$productId;
        // inline the UNLISTED enum literal; only the id is a variable
        $query = 'mutation($id: ID!) { productUpdate(product: { id: $id, status: UNLISTED }) '
               .'{ product { id status } userErrors { field message } } }';
        try {
            $resp = Http::timeout(15)->withHeaders([
                'X-Shopify-Access-Token' => config('services.shopify.token'), 'Content-Type' => 'application/json',
            ])->post("https://{$domain}/admin/api/{$version}/graphql.json", ['query' => $query, 'variables' => ['id' => $gid]]);
            return $resp->successful()
                && empty($resp->json('data.productUpdate.userErrors'))
                && $resp->json('data.productUpdate.product.status') === 'UNLISTED';
        } catch (\Throwable) {
            return false;
        }
    }

    /** Turn tracking OFF for a variant (safety fallback: a product whose stock we couldn't set
     *  must stay payable, not read "sold out"). Best-effort. */
    public static function untrackVariant(string $variantId): void
    {
        if (!self::configured() || $variantId === '') {
            return;
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        try {
            Http::timeout(15)->withHeaders([
                'X-Shopify-Access-Token' => config('services.shopify.token'), 'Content-Type' => 'application/json',
            ])->put("https://{$domain}/admin/api/{$version}/variants/{$variantId}.json", [
                'variant' => ['id' => $variantId, 'inventory_management' => null, 'inventory_policy' => 'continue'],
            ]);
        } catch (\Throwable) { /* best-effort */ }
    }

    /**
     * Clear `requires_shipping` on an EXISTING variant, so a link created before that default was
     * corrected stops dead-ending at "Shipping not available". Returns true only when Shopify
     * confirms the variant now reads false — the repair command counts on that, because a silent
     * failure here would leave an unpayable link looking fixed.
     */
    public static function clearVariantShipping(string $variantId): bool
    {
        if (!self::configured() || $variantId === '') {
            return false;
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        try {
            $resp = Http::timeout(15)->withHeaders([
                'X-Shopify-Access-Token' => config('services.shopify.token'), 'Content-Type' => 'application/json',
            ])->put("https://{$domain}/admin/api/{$version}/variants/{$variantId}.json", [
                'variant' => ['id' => $variantId, 'requires_shipping' => false],
            ]);
        } catch (\Throwable) {
            return false;
        }
        return $resp->successful() && $resp->json('variant.requires_shipping') === false;
    }

    /** Build the storefront product description: the sign specs shown under the CTA. On a multi-
     *  sign quote this concatenates EVERY sign's specs (A, B, C…), each under its own heading —
     *  not just the first sign (#10). Falls back to the sign type when a part has no spec text. */
    public static function specsHtml(array $gd, string $signType = ''): string
    {
        $partOf = function (array $p, string $fallbackType): string {
            $specs = trim((string) ($p['custom_spec']['specText'] ?? ($p['ai']['fullSpec'] ?? '')));
            if ($specs === '') {
                // fall back to the ACTUAL spec block shown on the proposal (HTML) → plain text
                $html = (string) ($p['proposal_state']['specBody'] ?? '');
                if ($html !== '') {
                    $specs = trim(html_entity_decode(strip_tags(preg_replace('/<br\s*\/?>/i', "\n", $html)), ENT_QUOTES | ENT_HTML5));
                }
            }
            return $specs !== '' ? nl2br(e($specs)) : e($fallbackType);
        };

        $parts = (isset($gd['parts']) && is_array($gd['parts']) && $gd['parts'] !== []) ? $gd['parts'] : null;
        if (!$parts) {
            return $partOf($gd, $signType);   // legacy single sign
        }
        if (count($parts) === 1) {
            return $partOf($parts[0], $parts[0]['tpl_name'] ?? $signType);
        }
        // MULTIPLE SIGNS -> THE LINE ITEMS, NOT THE SPECS.
        //
        // Every sign's full specification block used to be stacked on the storefront page, one under
        // the next. Past three signs that is a wall of text nobody reads, and it is the customer's
        // PAYMENT page: what belongs there is what they are paying for, which is the line items. The
        // specifications live on the proposal PDF, where the customer already has them and can check
        // them against the drawing beside them.
        $rows = [];
        foreach ($parts as $i => $p) {
            $letter = chr(65 + $i);                       // A, B, C...
            $name = trim((string) ($p['custom_spec']['itemDesc'] ?? $p['tpl_name'] ?? ''));
            $qty = max(1, (int) ($p['proposal_state']['__qty'] ?? $p['custom_spec']['qty'] ?? $p['answers']['qty'] ?? 1));
            $label = $name !== '' ? $name : ('Sign '.$letter);
            $rows[] = '<li>'.e($label).($qty > 1 ? ' <strong>x '.$qty.'</strong>' : '').'</li>';
            // The extra rows the rep added on that sign's proposal are line items too. A discount is
            // shown as a discount: a customer reading a list of what they are paying for should see
            // the deduction they were promised, not a silently smaller total.
            foreach ((array) ($p['proposal_state']['__items'] ?? []) as $it) {
                $desc = trim((string) ($it['desc'] ?? ''));
                if ($desc === '') {
                    continue;
                }
                $rows[] = '<li>'.((($it['kind'] ?? '') === 'discount') ? 'Less: ' : '').e($desc).'</li>';
            }
        }
        return $rows ? '<ul>'.implode('', $rows).'</ul>' : '';
    }

    /** "LED Signs" when any sign is illuminated / LED, else "Business Signs" (#3). Reads the sign
     *  type + spec text of every part. */
    public static function signCategory(array $gd, string $signType = ''): string
    {
        $parts = (isset($gd['parts']) && is_array($gd['parts']) && $gd['parts'] !== []) ? $gd['parts'] : [$gd];
        $haystack = $signType;
        foreach ($parts as $p) {
            $haystack .= ' '.($p['tpl_name'] ?? '').' '.($p['custom_spec']['specText'] ?? '').' '.($p['ai']['fullSpec'] ?? '');
        }
        return preg_match('/\b(LED|ILLUMINAT|NEON|LIT)\b/i', $haystack) ? 'LED Signs' : 'Business Signs';
    }

    /** Shopify's hard limit on both `title` and `handle`. Exceeding it is a 422, not a warning. */
    private const SHOPIFY_MAX = 255;

    /**
     * The product title, guaranteed to fit Shopify's 255 characters.
     *
     * A multi-sign quote's title is every sign's description joined with " & " plus " FOR Company",
     * so it grows with the page count: at four or five signs it passed 255 and Shopify rejected the
     * whole product — the rep saw "Shopify couldn't create the product" and had no link at all
     * (reported 2026-08 on a 3-page LA Fitness quote).
     *
     * The quote ID and the payment kind are the parts a human actually needs — the ID identifies the
     * job, the kind says what is being paid — so they are never sacrificed. Only the description
     * shrinks: to the FIRST sign plus "+N more", which reads like a summary rather than a sentence
     * cut off mid-word. If even that will not fit (one absurdly long description) it is trimmed on a
     * word boundary as a last resort. Titles that already fit are untouched, so every single-sign
     * quote produces exactly the title it did before.
     */
    public static function fitTitle(string $quoteId, string $baseTitle, string $kindLabel, array $gd = []): string
    {
        $compose = fn (string $base) => trim($quoteId.' - '.$base.' - '.$kindLabel);
        $full = $compose($baseTitle);
        if (mb_strlen($full) <= self::SHOPIFY_MAX) {
            return $full;
        }

        // "First sign +3 more" — the count comes from the parts list, which is what made it long.
        $parts = (isset($gd['parts']) && is_array($gd['parts'])) ? $gd['parts'] : [];
        $first = trim(explode(' & ', $baseTitle)[0]);
        if (count($parts) > 1) {
            $summary = $compose($first.' +'.(count($parts) - 1).' more');
            if (mb_strlen($summary) <= self::SHOPIFY_MAX) {
                return $summary;
            }
        }

        // Last resort: keep the ID and the kind, give the description whatever is left.
        $budget = self::SHOPIFY_MAX - mb_strlen($compose(''));
        $cut = mb_substr($first !== '' ? $first : $baseTitle, 0, max(1, $budget - 1));
        $space = mb_strrpos($cut, ' ');
        if ($space !== false && $space > $budget / 2) {
            $cut = mb_substr($cut, 0, $space);
        }
        return $compose(trim($cut).'…');
    }

    /** The handle: slug of the title + an unguessable suffix, inside the same 255 limit. */
    public static function fitHandle(string $title): string
    {
        $suffix = '-'.\Illuminate\Support\Str::lower(\Illuminate\Support\Str::random(8));
        $slug = \Illuminate\Support\Str::slug($title);
        return mb_substr($slug, 0, self::SHOPIFY_MAX - mb_strlen($suffix)).$suffix;
    }

    /** Human label for a payment kind (goes in the title + variant). */
    public static function kindLabel(string $kind): string
    {
        return match ($kind) {
            'deposit' => '50% Deposit',
            'balance' => 'Remaining Balance (50%)',
            default   => 'Full Payment',
        };
    }

    /** Title Case: first letter of each word capitalized, not ALL CAPS (#4). */
    public static function titleCase(string $s): string
    {
        return \Illuminate\Support\Str::title(mb_strtolower(trim($s)));
    }

    /**
     * Create the product in Shopify. Returns ['ok'=>true, 'product_id','handle','url','variants']
     * on success, or ['ok'=>false, 'reason'=>..., 'status'=>?, 'message'=>?] on failure so the
     * caller can show WHY (bad token, missing scope, rejected payload, …).
     */
    public static function createProduct(array $payload): array
    {
        if (!self::configured()) {
            return ['ok' => false, 'reason' => 'not_configured'];
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');

        try {
            $resp = Http::timeout(20)->withHeaders([
                'X-Shopify-Access-Token' => config('services.shopify.token'),
                'Content-Type'           => 'application/json',
            ])->post("https://{$domain}/admin/api/{$version}/products.json", $payload);
        } catch (\Throwable $e) {
            return ['ok' => false, 'reason' => 'network', 'message' => $e->getMessage()];
        }

        if (!$resp->successful()) {
            return ['ok' => false, 'reason' => 'shopify_error', 'status' => $resp->status(), 'message' => self::errorText($resp->status(), $resp->json() ?? $resp->body())];
        }
        $p = $resp->json('product');
        if (!$p) {
            return ['ok' => false, 'reason' => 'no_product'];
        }
        $variants = collect($p['variants'] ?? [])->map(fn ($v) => [
            'id'                => (string) $v['id'],
            'inventory_item_id' => (string) ($v['inventory_item_id'] ?? ''),
            'title'             => $v['title'] ?? $v['option1'] ?? '',
            'price'             => $v['price'] ?? '',
        ])->all();
        return [
            'ok'         => true,
            'product_id' => (string) $p['id'],
            'handle'     => $p['handle'] ?? '',
            // PRODUCT-PAGE link: the customer lands on the sign's preview (image + specs) and pays
            // from there. KNOWN edge case: Shopify's cart is shared per browser session, so a customer
            // who opens SEVERAL of their own links in the SAME browser (e.g. deposit + balance) sees
            // them add up in one cart. The normal flow — one link, one payment — is unaffected, and a
            // fresh/incognito session always shows a single item. (Draft-order invoices remove even
            // that edge case but need the write_draft_orders Shopify scope — deferred by decision.)
            'url'        => 'https://'.self::storefrontHost().'/products/'.($p['handle'] ?? ''),
            'variants'   => $variants,
        ];
    }

    /** Lightweight connection check (GET shop.json) — used by /api/shopify/status. */
    /** Fetch a product's handle by id (for rebuilding an existing link's URL). Null on any failure. */
    public static function productHandle(string $productId): ?string
    {
        if (!self::configured()) {
            return null;
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        try {
            $resp = Http::timeout(15)->withHeaders(['X-Shopify-Access-Token' => config('services.shopify.token')])
                ->get("https://{$domain}/admin/api/{$version}/products/{$productId}.json", ['fields' => 'handle']);
        } catch (\Throwable) {
            return null;
        }
        return $resp->successful() ? ($resp->json('product.handle') ?: null) : null;
    }

    public static function testConnection(): array
    {
        if (!self::configured()) {
            return ['ok' => false, 'reason' => 'not_configured'];
        }
        $domain  = self::domain();
        $version = config('services.shopify.version', '2025-01');
        try {
            $resp = Http::timeout(15)->withHeaders(['X-Shopify-Access-Token' => config('services.shopify.token')])
                ->get("https://{$domain}/admin/api/{$version}/shop.json");
        } catch (\Throwable $e) {
            return ['ok' => false, 'reason' => 'network', 'message' => $e->getMessage()];
        }
        if ($resp->successful()) {
            return ['ok' => true, 'shop' => $resp->json('shop.name')];
        }
        return ['ok' => false, 'status' => $resp->status(), 'message' => self::errorText($resp->status(), $resp->json() ?? $resp->body())];
    }

    /** Turn a Shopify error response into a short human message. */
    private static function errorText(int $status, mixed $body): string
    {
        $detail = '';
        if (is_array($body)) {
            $errors = $body['errors'] ?? $body;
            $detail = is_array($errors) ? implode('; ', array_map(fn ($v) => is_array($v) ? implode(', ', $v) : (string) $v, (array) $errors)) : (string) $errors;
        } elseif (is_string($body)) {
            $detail = mb_substr(strip_tags($body), 0, 200);
        }
        $hint = match ($status) {
            401 => 'invalid API token',
            403 => 'the token is missing a scope (needs write_products)',
            404 => 'store domain not found — check SHOPIFY_STORE_DOMAIN',
            422 => 'Shopify rejected the product data',
            default => '',
        };
        return trim("HTTP {$status}".($hint ? " ({$hint})" : '').($detail ? ": {$detail}" : ''));
    }
}
