<?php

use App\Models\Quote;
use App\Services\ShopifyService;

it('makes a single Full Payment variant at the full price, with NO option tag (#9)', function () {
    $v = ShopifyService::variantsFor(3500.0, 'full');
    expect($v)->toHaveCount(1);
    expect($v[0])->not->toHaveKey('option1');
    expect($v[0]['price'])->toBe('3500.00');
});

it('makes a single 50% Deposit variant at half', function () {
    $v = ShopifyService::variantsFor(3500.0, 'deposit');
    expect($v)->toHaveCount(1);
    expect($v[0])->not->toHaveKey('option1');
    expect($v[0]['price'])->toBe('1750.00');
});

it('makes a single Balance variant at half', function () {
    $v = ShopifyService::variantsFor(3500.0, 'balance');
    expect($v)->toHaveCount(1);
    expect($v[0])->not->toHaveKey('option1');
    expect($v[0]['price'])->toBe('1750.00');
});

it('tracks inventory and makes each variant a one-time purchase (1 in stock, deny)', function () {
    foreach (['full', 'deposit', 'balance'] as $kind) {
        $v = ShopifyService::variantsFor(1000.0, $kind)[0];
        expect($v['inventory_management'])->toBe('shopify');   // tracked
        expect($v['inventory_policy'])->toBe('deny');          // sold out after one purchase
    }
    // the stock is set to 1 at the US location after create; if that fails the controller
    // untracks the variant so it can never become an unpayable "sold out".
});

// RATCHET (2026-07-30): a live $23,000 checkout could not be paid. The variant was created as a
// shippable good, so Shopify demanded a shipping rate for the customer's address and, finding no
// matching zone, refused the order — "not available for delivery to your location". The address was
// correct; the flag was wrong. This test exists so that flag can never come back.
it('never requires shipping — the variant is a PAYMENT, not a parcel', function () {
    foreach (['full', 'deposit', 'balance'] as $kind) {
        expect(ShopifyService::variantsFor(23000.0, $kind)[0]['requires_shipping'])->toBeFalse();
    }
});

it('rounds a 50% amount to cents', function () {
    expect(ShopifyService::variantsFor(3499.99, 'deposit')[0]['price'])->toBe('1750.00');
});

it('Title-cases text (first letter of each word, not ALL CAPS)', function () {
    expect(ShopifyService::titleCase('FACE LIT CHANNEL LETTERS FOR SIGNARAMA'))->toBe('Face Lit Channel Letters For Signarama');
});

it('labels the payment kind for the title', function () {
    expect(ShopifyService::kindLabel('full'))->toBe('Full Payment');
    expect(ShopifyService::kindLabel('deposit'))->toBe('50% Deposit');
    expect(ShopifyService::kindLabel('balance'))->toBe('Remaining Balance (50%)');
});

// Each payment link is its own single-variant product priced at exactly the amount for that kind
// (full = full, deposit/balance = half). One link = one product = one amount. (A customer opening
// several of their OWN links in the same browser can still stack them in Shopify's shared cart —
// an accepted edge case; the normal one-link flow bills exactly this.)
it('gives each payment kind its own single-amount variant so one link bills one amount', function () {
    $full = ShopifyService::variantsFor(6000.0, 'full');
    $dep  = ShopifyService::variantsFor(6000.0, 'deposit');
    expect($full)->toHaveCount(1);
    expect($dep)->toHaveCount(1);
    expect($full[0]['price'])->toBe('6000.00');
    expect($dep[0]['price'])->toBe('3000.00');
});

// RATCHET (2026-08-06): a 3-page LA Fitness quote could not be paid at all. A multi-sign title is
// every sign's description joined with " & " plus " FOR {Company}", so it grows with the page count;
// past 255 characters Shopify rejected the whole product with TWO errors — the title AND the handle,
// which is derived from it. The rep saw "Shopify couldn't create the product" and got no link.
// These tests exist so a long quote can never again cost a customer the ability to pay.
it('keeps a long multi-sign title inside Shopify 255-character limit', function () {
    $long = implode(' & ', array_fill(0, 6, 'DOUBLE SIDED ILLUMINATED PYLON TENANT PANEL WITH ROUTED ALUMINIUM FACE')).' FOR TRADEMARK SIGN LLC';
    $gd = ['parts' => array_fill(0, 6, ['custom_spec' => ['itemDesc' => 'PYLON TENANT PANEL']])];

    $title = ShopifyService::fitTitle('EC116713', $long, 'Full Payment', $gd);

    expect(mb_strlen($title))->toBeLessThanOrEqual(255);
    expect($title)->toContain('EC116713');        // the job is still identifiable
    expect($title)->toContain('Full Payment');    // and so is what is being paid
    expect($title)->toContain('+5 more');         // summarised, not cut off mid-word
});

it('keeps the derived handle inside the 255-character limit too', function () {
    $title = str_repeat('LONG SIGN DESCRIPTION ', 30);
    $handle = ShopifyService::fitHandle($title);
    expect(mb_strlen($handle))->toBeLessThanOrEqual(255);
    expect($handle)->toMatch('/-[a-z0-9]{8}$/');   // the unguessable suffix survives
});

it('leaves a title that already fits exactly as it was', function () {
    $title = ShopifyService::fitTitle('EC100200', 'Channel Letters For Signarama', 'Full Payment');
    expect($title)->toBe('EC100200 - Channel Letters For Signarama - Full Payment');
});

it('truncates on a word boundary when even one description is too long', function () {
    $one = str_repeat('ILLUMINATED ', 40);
    $title = ShopifyService::fitTitle('EC1', $one, 'Full Payment');
    expect(mb_strlen($title))->toBeLessThanOrEqual(255);
    expect($title)->toEndWith('… - Full Payment');
});

// The customer's PAYMENT page should say what they are paying for. Stacking every sign's full
// specification block there was both unreadable past three signs and the source of the size blowup.
it('lists the line items, not the specifications, for a multi-sign quote', function () {
    $gd = ['parts' => [
        ['custom_spec' => ['itemDesc' => 'PYLON TENANT PANEL', 'specText' => 'FACE: ROUTED ALUMINIUM'],
         'proposal_state' => ['__qty' => 2, '__items' => [
             ['desc' => 'FREIGHT CHARGES FOR COMPLETE PROJECT', 'amount' => 1250, 'kind' => 'add'],
             ['desc' => 'GOODWILL DISCOUNT', 'amount' => 500, 'kind' => 'discount'],
         ]]],
        ['custom_spec' => ['itemDesc' => 'WALL SIGN', 'specText' => 'FACE: ACRYLIC WITH VINYL']],
    ]];

    $html = ShopifyService::specsHtml($gd);

    expect($html)->toContain('PYLON TENANT PANEL');
    expect($html)->toContain('x 2');                                    // quantity is a fact they pay for
    expect($html)->toContain('FREIGHT CHARGES FOR COMPLETE PROJECT');
    expect($html)->toContain('Less: GOODWILL DISCOUNT');                // a promised deduction is shown
    expect($html)->toContain('WALL SIGN');
    expect($html)->not->toContain('ROUTED ALUMINIUM');                  // specs stay on the proposal
    expect($html)->not->toContain('ACRYLIC WITH VINYL');
});

it('still shows the full specification for a single-sign quote', function () {
    $gd = ['parts' => [['custom_spec' => ['itemDesc' => 'WALL SIGN', 'specText' => "FACE: ACRYLIC\nRETURNS: 3\""]]]];
    expect(ShopifyService::specsHtml($gd))->toContain('FACE: ACRYLIC');
});
