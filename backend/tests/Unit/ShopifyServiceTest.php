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

it('keeps every variant always purchasable (never blocked by stock)', function () {
    foreach (['full', 'deposit', 'balance'] as $kind) {
        expect(ShopifyService::variantsFor(1000.0, $kind)[0]['inventory_policy'])->toBe('continue');
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
