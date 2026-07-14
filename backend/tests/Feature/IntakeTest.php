<?php

/* Intake required fields: a quote needs a Job Name (#6) and at least one of Company / Client
   (#7). Enforced on the API so the form can't be bypassed. */

it('rejects a quote with neither company nor client', function () {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['job_name' => 'Storefront sign'])
        ->assertStatus(422);
});

it('rejects a quote with no job name', function () {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['company_name' => 'Signarama'])
        ->assertStatus(422);
});

it('accepts a quote with only a client name and a job name', function () {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['client_name' => 'Jane Doe', 'job_name' => 'Window decal'])
        ->assertCreated();
});

it('accepts a quote with only a company name and a job name', function () {
    login(makeUser(['role' => 'admin']));
    $this->postJson('/api/quotes', ['company_name' => 'Signarama', 'job_name' => 'Channel letters'])
        ->assertCreated();
});
