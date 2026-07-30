<?php

use App\Services\ShopifyService;
use Illuminate\Support\Facades\Http;

/* ── INVENTORY RATCHET (2026-07-30) ──────────────────────────────────────────────────────────────
   Every payment-link product in the store read "Inventory not tracked" and fulfilled from the wrong
   warehouse; the team was correcting them by hand, product by product.

   Two bugs, both pinned below:
     1. the location came from `locations.json?limit=1` — "whichever Shopify lists first". This store
        has france / NY / US warehouses, so it was never reliably the US one.
     2. a brand-new variant has no inventory level at a NON-default location, so setting one is
        refused until the item is CONNECTED there. That refusal made PaymentLinkController fall
        through to its untrackVariant() safety net — which is exactly why the links stayed payable
        and the fault went unnoticed for weeks.

   These tests fake the Shopify API, so they assert the REQUESTS we send — the part that was wrong.
   They cannot prove Shopify's own behaviour, only that we stopped asking the wrong question.
   (Live in Feature, not Unit: the Unit suite doesn't boot the app, and these need config + Http.) */

function fakeShopifyCreds(): void
{
    config()->set('services.shopify.domain', 'epic-test.myshopify.com');
    config()->set('services.shopify.token', 'shpat_test');
    config()->set('services.shopify.location_id', null);
    config()->set('services.shopify.location_name', 'US Warehouse');
}

function shopifyLocations(): array
{
    return ['locations' => [
        ['id' => 111, 'name' => 'france warehouse', 'active' => true],
        ['id' => 222, 'name' => 'NY Warehouse', 'active' => true],
        ['id' => 333, 'name' => 'US Warehouse', 'active' => true],
    ]];
}

it('stocks the US warehouse BY NAME, never "the first location Shopify returns"', function () {
    fakeShopifyCreds();
    Http::fake([
        '*/locations.json*'           => Http::response(shopifyLocations()),
        '*/inventory_levels/set.json' => Http::response(['inventory_level' => ['available' => 1]]),
    ]);

    expect(ShopifyService::setInventoryOne('inv_1'))->toBeTrue();

    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'inventory_levels/set.json')
            && (string) $request['location_id'] === '333'    // US Warehouse — not france (111), not NY (222)
            && $request['available'] === 1;
    });
});

it('connects the item to the location and retries when the first set is refused', function () {
    fakeShopifyCreds();
    $setCalls = 0;
    Http::fake([
        '*/locations.json*' => Http::response(shopifyLocations()),
        // Shopify's real answer for an item that has no level at this location yet
        '*/inventory_levels/set.json' => function () use (&$setCalls) {
            $setCalls++;
            return $setCalls === 1
                ? Http::response(['errors' => 'Inventory item does not have inventory at this location'], 422)
                : Http::response(['inventory_level' => ['available' => 1]]);
        },
        '*/inventory_levels/connect.json' => Http::response(['inventory_level' => ['available' => 0]]),
    ]);

    // Before the fix this returned FALSE, the caller untracked the variant, and the product read
    // "Inventory not tracked" — the state the team has been fixing by hand.
    expect(ShopifyService::setInventoryOne('inv_1'))->toBeTrue();
    expect($setCalls)->toBe(2);
    Http::assertSent(fn ($r) => str_contains($r->url(), 'inventory_levels/connect.json')
        && (string) $r['location_id'] === '333');
});

it('prefers an explicit SHOPIFY_LOCATION_ID over the name lookup', function () {
    fakeShopifyCreds();
    config()->set('services.shopify.location_id', '999');
    Http::fake(['*' => Http::response([])]);

    expect(ShopifyService::usLocationId())->toBe('999');
    Http::assertNothingSent();      // an exact id needs no lookup at all
});

it('falls back to a name containing "us", then to the first location', function () {
    fakeShopifyCreds();
    config()->set('services.shopify.location_name', 'Warehouse That Does Not Exist');
    Http::fake(['*/locations.json*' => Http::response(shopifyLocations())]);

    // 'US Warehouse' still contains "us" → 333. A store with no US-ish name at all gets the first
    // location, so a single-warehouse store keeps working.
    expect(ShopifyService::usLocationId())->toBe('333');
});
