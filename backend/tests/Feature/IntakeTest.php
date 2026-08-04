<?php

/* Intake required fields: a quote needs a Quote ID, a Job Name (#6) and at least one of
   Company / Client (#7). Enforced on the API so the form can't be bypassed.

   Every case below sends a VALID quote_id and varies only the field under test. The rep assigns the
   Quote ID by hand now, so a payload without one 422s on that alone — which made the two "rejects"
   cases pass without ever exercising the rule they name, and the two "accepts" cases fail even though
   the rules work. A test that cannot fail for its stated reason is not a gate. */

$id = fn () => 'EC'.random_int(100000, 999999);

it('rejects a quote with neither company nor client', function () use ($id) {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['quote_id' => $id(), 'job_name' => 'Storefront sign'])
        ->assertStatus(422)
        ->assertJson(['error' => 'Enter a Company Name or a Client Name (at least one).']);
});

it('rejects a quote with no job name', function () use ($id) {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['quote_id' => $id(), 'company_name' => 'Signarama'])
        ->assertStatus(422)
        ->assertJson(['error' => 'Job Name is required.']);
});

it('rejects a quote with no quote id', function () {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['company_name' => 'Signarama', 'job_name' => 'Channel letters'])
        ->assertStatus(422);
});

it('accepts a quote with only a client name and a job name', function () use ($id) {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['quote_id' => $id(), 'client_name' => 'Jane Doe', 'job_name' => 'Window decal'])
        ->assertCreated();
});

it('accepts a quote with only a company name and a job name', function () use ($id) {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['quote_id' => $id(), 'company_name' => 'Signarama', 'job_name' => 'Channel letters'])
        ->assertCreated();
});

it('automatically assigns Rod as representative on quotes Rod creates', function () use ($id) {
    login(makeUser(['username' => 'rod', 'full_name' => 'Rod Muffet']));

    $response = $this->postJson('/api/quotes', [
        'quote_id' => $id(), 'company_name' => 'Rod Client', 'job_name' => 'Channel letters',
    ])->assertCreated();

    expect($response->json('sales_rep'))->toBe('Rod Muffet');
});

it('automatically assigns Ed case-insensitively on quotes Ed creates', function () use ($id) {
    login(makeUser(['username' => 'Ed', 'full_name' => 'ED']));

    $response = $this->postJson('/api/quotes', [
        'quote_id' => $id(), 'company_name' => 'Ed Client', 'job_name' => 'Monument sign',
    ])->assertCreated();

    expect($response->json('sales_rep'))->toBe('ED');
});

it('keeps blank representative behavior unchanged for every other creator', function () use ($id) {
    login(makeUser(['username' => 'another-rep', 'full_name' => 'Another Rep']));

    $response = $this->postJson('/api/quotes', [
        'quote_id' => $id(), 'company_name' => 'Shared Client', 'job_name' => 'Window vinyl',
    ])->assertCreated();

    expect($response->json('sales_rep'))->toBe('');
});
