<?php

/* Authorization invariants: quote visibility scoping, admin-only destruction, and the
   cross-parent guard on restore. A hole here shows one rep another rep's customers. */

use App\Models\QuoteCheckpoint;
use Laravel\Sanctum\Sanctum;

it('hides another rep\'s quote (show + revisions)', function () {
    $owner = makeUser();
    $other = makeUser();
    $quote = makeQuote(['sales_rep' => $owner->full_name, 'assigned_to' => $owner->full_name]);

    login($other);
    $this->getJson("/api/quotes/{$quote->quote_id}")->assertStatus(403);
    $this->getJson("/api/quotes/{$quote->quote_id}/revisions")->assertStatus(403);
});

it('shows a repless (shared) quote to everyone', function () {
    login(makeUser());
    $quote = makeQuote(['sales_rep' => '']);

    $this->getJson("/api/quotes/{$quote->quote_id}")->assertOk();
});

it('shows Rod only his own representative rows in All Quotes', function () {
    $rod = makeUser(['username' => 'rod', 'full_name' => 'Rod Muffet']);
    $own = makeQuote(['sales_rep' => 'Rod Muffet', 'assigned_to' => '']);
    makeQuote(['sales_rep' => 'ED', 'assigned_to' => 'Rod Muffet']);
    makeQuote(['sales_rep' => '', 'assigned_to' => 'Rod Muffet']);
    makeQuote(['sales_rep' => null, 'assigned_to' => '']);

    login($rod);
    $rows = $this->getJson('/api/quotes')->assertOk()->json();

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['quote_id'])->toBe($own->quote_id);
});

it('shows Ed only his own representative rows in All Quotes, case-insensitively', function () {
    $ed = makeUser(['username' => 'Ed', 'full_name' => 'ED']);
    $own = makeQuote(['sales_rep' => 'ED']);
    makeQuote(['sales_rep' => 'Rod Muffet', 'assigned_to' => 'ED']);
    makeQuote(['sales_rep' => '']);

    login($ed);
    $rows = $this->getJson('/api/quotes')->assertOk()->json();

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['quote_id'])->toBe($own->quote_id);
});

it('keeps the existing shared and assigned list visibility for other sales reps', function () {
    $rep = makeUser(['username' => 'another-rep', 'full_name' => 'Another Rep']);
    makeQuote(['sales_rep' => '', 'assigned_to' => '']);
    makeQuote(['sales_rep' => 'Somebody Else', 'assigned_to' => 'Another Rep']);
    makeQuote(['sales_rep' => 'Somebody Else', 'assigned_to' => '']);

    login($rep);
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount(2);
});

it('keeps administrator visibility across every representative in All Quotes', function () {
    makeQuote(['sales_rep' => 'Rod Muffet']);
    makeQuote(['sales_rep' => 'ED']);
    makeQuote(['sales_rep' => '']);

    login(makeUser(['username' => 'manager-admin', 'role' => 'admin']));
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount(3);
});

// one login per test — the sanctum guard caches the first authenticated user for the
// lifetime of the test app, so a second login() inside the same test silently no-ops
it('blocks quote deletion for ordinary reps', function () {
    $quote = makeQuote(['sales_rep' => '']);
    login(makeUser());
    $this->deleteJson("/api/quotes/{$quote->quote_id}")->assertStatus(403);
});

it('allows quote deletion for admins', function () {
    $quote = makeQuote(['sales_rep' => '']);
    login(makeUser(['role' => 'admin']));
    $this->deleteJson("/api/quotes/{$quote->quote_id}")->assertOk();
});

it('404s a restore that targets a checkpoint of a DIFFERENT quote', function () {
    login(makeUser(['role' => 'admin']));
    $a = makeQuote();
    $b = makeQuote();
    $cp = QuoteCheckpoint::create([
        'quote_id' => $a->id, 'seq' => 1, 'label' => $a->quote_id.'-rev1',
        'trigger' => 'manual', 'created_at' => now(),
    ]);

    // checkpoint belongs to A — restoring it "via" B must be a 404, never a data write
    $this->postJson("/api/quotes/{$b->quote_id}/checkpoints/{$cp->id}/restore")
        ->assertStatus(404);
});

it('blocks a restore on a quote the user cannot see', function () {
    $owner = makeUser();
    $quote = makeQuote(['sales_rep' => $owner->full_name, 'assigned_to' => $owner->full_name]);
    $cp = QuoteCheckpoint::create([
        'quote_id' => $quote->id, 'seq' => 1, 'label' => $quote->quote_id.'-rev1',
        'trigger' => 'manual', 'created_at' => now(),
    ]);

    login(makeUser());   // stranger
    $this->postJson("/api/quotes/{$quote->quote_id}/checkpoints/{$cp->id}/restore")
        ->assertStatus(403);
});

/* ── Quote makers (reported 2026-08-05: EC116706 / EC116707 unreachable) ─────────────────────
   A quote maker is not a representative, so no quote ever carries their name. While the role sat
   outside seesAllQuotes() the rep-name rule denied them every quote that had a rep on it — the
   whole book, including quotes they had just written. */

it('lets a quote maker open a quote that carries another person\'s rep name', function () {
    $maker = makeUser(['role' => 'quote_maker']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet', 'assigned_to' => 'Rod Muffet']);

    login($maker);
    $this->getJson("/api/quotes/{$quote->quote_id}")->assertOk();
});

it('lists every quote for a quote maker, whoever the rep is', function () {
    $maker = makeUser(['role' => 'quote_maker']);
    makeQuote(['sales_rep' => 'Rod Muffet']);
    makeQuote(['sales_rep' => 'ED']);
    makeQuote(['sales_rep' => '']);

    login($maker);
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount(3);
});

it('still hides another rep\'s quote from a sales rep', function () {
    // The widening above must not have loosened the role it was not about.
    $other = makeUser(['role' => 'sales_rep']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet', 'assigned_to' => 'Rod Muffet']);

    login($other);
    $this->getJson("/api/quotes/{$quote->quote_id}")->assertStatus(403);
});

it('lets the author reopen a quote they created for someone else', function () {
    // The trap that made the original bug dangerous rather than merely annoying: put another
    // person's name in Sales Rep, save, and the quote you just wrote becomes unreachable.
    $author = makeUser(['role' => 'sales_rep']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet', 'assigned_to' => 'Rod Muffet', 'created_by' => $author->id]);

    login($author);
    $this->getJson("/api/quotes/{$quote->quote_id}")->assertOk();
    $this->getJson("/api/quotes/{$quote->quote_id}/revisions")->assertOk();
});

/* ── Hidden quotes: a REP'S OWN list, and nobody else's ──────────────────────────────────────
   The danger in this feature is leakage in either direction: one rep's tidy-up removing work
   from someone else's screen, or a rep hiding a quote they were never allowed to see. */

it('hides a quote from the rep who hid it, and from no one else', function () {
    $rod = makeUser(['username' => 'rod', 'full_name' => 'Rod Muffet', 'role' => 'sales_rep']);
    $admin = makeUser(['role' => 'admin']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet']);

    login($rod);
    $this->postJson("/api/quotes/{$quote->quote_id}/hide")->assertOk();
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount(0);

    // The same quote is still in the book for everyone else.
    login($admin);
    $rows = collect($this->getJson('/api/quotes')->assertOk()->json())->pluck('quote_id');
    expect($rows)->toContain($quote->quote_id);
});

it('lists a hidden quote under ?hidden=1 and restores it on unhide', function () {
    $rod = makeUser(['username' => 'rod', 'full_name' => 'Rod Muffet', 'role' => 'sales_rep']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet']);

    login($rod);
    $this->postJson("/api/quotes/{$quote->quote_id}/hide")->assertOk();
    expect($this->getJson('/api/quotes?hidden=1')->assertOk()->json())->toHaveCount(1);

    $this->deleteJson("/api/quotes/{$quote->quote_id}/hide")->assertOk();
    expect($this->getJson('/api/quotes?hidden=1')->assertOk()->json())->toHaveCount(0);
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount(1);
});

it('is idempotent — hiding twice leaves one row and one hidden quote', function () {
    $rod = makeUser(['username' => 'rod', 'full_name' => 'Rod Muffet', 'role' => 'sales_rep']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet']);

    login($rod);
    $this->postJson("/api/quotes/{$quote->quote_id}/hide")->assertOk();
    $this->postJson("/api/quotes/{$quote->quote_id}/hide")->assertOk();
    expect($this->getJson('/api/quotes?hidden=1')->assertOk()->json())->toHaveCount(1);
});

it('does not let one rep hide a quote out of another rep\'s list', function () {
    // Two ORDINARY reps, deliberately not rod/ed: those two carry the stricter private listing
    // (3905ffd), which excludes repless rows entirely — neither would have seen the shared quote
    // in the first place, so the test would prove nothing about hiding.
    $repA = makeUser(['role' => 'sales_rep']);
    $repB = makeUser(['role' => 'sales_rep']);
    $shared = makeQuote(['sales_rep' => '']);          // repless = visible to both

    login($repA);
    $this->postJson("/api/quotes/{$shared->quote_id}/hide")->assertOk();
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount(0);

    login($repB);
    expect(collect($this->getJson('/api/quotes')->assertOk()->json())->pluck('quote_id'))
        ->toContain($shared->quote_id);
});

it('refuses to hide a quote the rep cannot see', function () {
    $other = makeUser(['role' => 'sales_rep']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet', 'assigned_to' => 'Rod Muffet']);

    login($other);
    $this->postJson("/api/quotes/{$quote->quote_id}/hide")->assertStatus(403);
});

it('refuses hiding for roles that see the whole book, and gives them an empty hidden tab', function () {
    $admin = makeUser(['role' => 'admin']);
    $quote = makeQuote(['sales_rep' => 'Rod Muffet']);

    login($admin);
    $this->postJson("/api/quotes/{$quote->quote_id}/hide")->assertStatus(403);
    // ?hidden=1 must not fall through to "everything" for someone who has no hidden list.
    expect($this->getJson('/api/quotes?hidden=1')->assertOk()->json())->toHaveCount(0);
});

it('leaves the admin list untouched when a rep hides a quote', function () {
    $rod = makeUser(['username' => 'rod', 'full_name' => 'Rod Muffet', 'role' => 'sales_rep']);
    $admin = makeUser(['role' => 'admin']);
    makeQuote(['sales_rep' => 'Rod Muffet']);
    makeQuote(['sales_rep' => 'ED']);

    login($admin);
    $before = count($this->getJson('/api/quotes')->assertOk()->json());

    login($rod);
    $mine = collect($this->getJson('/api/quotes')->assertOk()->json())->first();
    $this->postJson("/api/quotes/{$mine['quote_id']}/hide")->assertOk();

    login($admin);
    expect($this->getJson('/api/quotes')->assertOk()->json())->toHaveCount($before);
});
