<?php

/* Automatic quote IDs (Rod, 2026-08-05).

   The danger is not "pick a number" — it is picking one that is free HERE but taken in Airtable,
   which this database has never seen. Every case below is really about that. */

use App\Models\ReservedQuoteId;
use App\Models\User;
use App\Support\QuoteIdAllocator;

it('assigns an id from the reserved band when the account asks for one', function () {
    $rod = makeUser(['role' => 'sales_rep', 'auto_quote_id' => true]);
    login($rod);

    $res = $this->postJson('/api/quotes', ['company_name' => 'Auto Co', 'job_name' => 'Auto job'])->assertCreated();
    $id = $res->json('quote_id');

    expect($id)->toMatch('/^EC9\d{5}$/')
        ->and((int) substr($id, 2))->toBeGreaterThanOrEqual(QuoteIdAllocator::BAND_START);
});

it('still requires a typed id from everyone else', function () {
    login(makeUser(['role' => 'sales_rep']));
    $this->postJson('/api/quotes', ['company_name' => 'Manual Co', 'job_name' => 'Manual job'])
        ->assertStatus(422);
});

it('never hands out an id reserved by the other system', function () {
    $taken = 'EC'.QuoteIdAllocator::BAND_START;
    ReservedQuoteId::create(['quote_id' => $taken, 'number' => QuoteIdAllocator::BAND_START, 'source' => 'airtable']);

    $rod = makeUser(['role' => 'sales_rep', 'auto_quote_id' => true]);
    login($rod);

    $id = $this->postJson('/api/quotes', ['company_name' => 'Co', 'job_name' => 'Job'])->assertCreated()->json('quote_id');
    expect($id)->not->toBe($taken)
        ->and((int) substr($id, 2))->toBeGreaterThan(QuoteIdAllocator::BAND_START);
});

it('does not repeat itself across consecutive quotes', function () {
    $rod = makeUser(['role' => 'sales_rep', 'auto_quote_id' => true]);
    login($rod);

    $ids = [];
    for ($i = 0; $i < 5; $i++) {
        $ids[] = $this->postJson('/api/quotes', ['company_name' => "Co {$i}", 'job_name' => "Job {$i}"])
            ->assertCreated()->json('quote_id');
    }
    expect(array_unique($ids))->toHaveCount(5);
});

it('leaves the house numbering alone — the band is far above it', function () {
    // The live sequence was at EC116714 when this was built. An auto id must never land in it,
    // or a rep continuing the house numbering by hand collides with one.
    expect(QuoteIdAllocator::BAND_START)->toBeGreaterThan(200000);
});

it('normalises the messy spellings the export carries', function () {
    expect(QuoteIdAllocator::normalise('#EC100187'))->toBe('EC100187')
        ->and(QuoteIdAllocator::normalise('  ec 100187 '))->toBe('EC100187')
        ->and(QuoteIdAllocator::normalise('EC100187'))->toBe('EC100187')
        ->and(QuoteIdAllocator::normalise('not an id'))->toBeNull();
});

it('honours a typed id even for an auto account', function () {
    // Auto-assignment fills a BLANK field; it does not seize control of one the rep filled in.
    $rod = makeUser(['role' => 'sales_rep', 'auto_quote_id' => true]);
    login($rod);

    $id = $this->postJson('/api/quotes', ['quote_id' => 'EC777001', 'company_name' => 'Co', 'job_name' => 'Job'])
        ->assertCreated()->json('quote_id');
    expect($id)->toBe('EC777001');
});
