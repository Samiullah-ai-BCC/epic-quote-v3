<?php

namespace App\Console\Commands;

use App\Models\PaymentLink;
use App\Services\ShopifyService;
use Illuminate\Console\Command;

/**
 * Make every EXISTING payment link payable again by clearing `requires_shipping` on its variant.
 *
 * Why this exists: payment-link variants were created as shippable goods, so Shopify demanded a
 * shipping RATE covering the customer's address before it would take the money. Where no zone
 * matched, the checkout dead-ended on "The products in your cart are not available for delivery to
 * your location" / "Shipping not available" — with a correct address typed in, on a real $23,000
 * order (2026-07-30). ShopifyService::variantsFor now sends `requires_shipping: false`, but that only
 * helps links created AFTERWARDS: a variant already in Shopify keeps the flag it was born with, and
 * every link the team has already sent a customer is still an unpayable dead end.
 *
 * Idempotent (Rule L5-7): clearing an already-cleared flag is a no-op, so it is safe to run as often
 * as you like. Best-effort per row — one unreachable product does not abort the rest — and it reports
 * counts. Nothing is written with --dry-run.
 *
 *   php artisan payments:fix-shipping --dry-run
 *   php artisan payments:fix-shipping
 */
class FixPaymentLinkShipping extends Command
{
    protected $signature = 'payments:fix-shipping
        {--dry-run : List the links that WOULD be repaired and exit without writing}
        {--unpaid-only : Skip links already marked paid (their charge already went through)}';

    protected $description = 'Clear requires_shipping on existing payment-link variants so checkout stops asking for a shipping rate';

    public function handle(): int
    {
        if (!ShopifyService::configured()) {
            $this->error('Shopify is not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_API_TOKEN) — nothing to repair against.');
            return self::FAILURE;
        }
        $dry = (bool) $this->option('dry-run');

        $query = PaymentLink::whereNotNull('shopify_variant_id')->orderBy('id');
        if ($this->option('unpaid-only')) {
            $query->where('status', '!=', 'paid');
        }
        $links = $query->get();

        if ($links->isEmpty()) {
            $this->info('No payment links with a stored variant id — nothing to do.');
            return self::SUCCESS;
        }

        $done = 0;
        $failed = 0;
        foreach ($links as $link) {
            $label = "#{$link->id} {$link->quote?->quote_id} {$link->kind} \${$link->amount}";
            if ($dry) {
                $this->line("[dry] would clear requires_shipping on variant {$link->shopify_variant_id} — {$label}");
                $done++;
                continue;
            }
            if (ShopifyService::clearVariantShipping((string) $link->shopify_variant_id)) {
                $this->line("  ✓ {$label}");
                $done++;
            } else {
                // Loud, per row: a link left shippable is a link a customer still cannot pay, and the
                // team needs to know WHICH one rather than a total that looks like success.
                $this->warn("  ✗ could not update variant {$link->shopify_variant_id} — {$label}"
                    . ' (product deleted in Shopify? re-create the link from the proposal)');
                $failed++;
            }
        }

        $verb = $dry ? 'would repair' : 'repaired';
        $this->info("{$verb}: {$done}, failed: {$failed}, total examined: ".$links->count());

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
