<?php

/* Two-factor auth, company-email restriction, and admin impersonation.
   These three touch sign-in itself: a hole here is either an open door or a locked-out team. */

use App\Models\Quote;
use App\Models\User;
use App\Support\Totp;

function admin(array $attrs = []): User
{
    return makeUser(array_merge(['role' => 'admin'], $attrs));
}

/**
 * Switch the test client to a different bearer token. The sanctum guard caches the first
 * authenticated user for the lifetime of the test app (see tests/Pest.php), so swapping the
 * header alone silently keeps the previous user — forget the guards to make the swap real.
 */
function asToken(string $token): void
{
    app('auth')->forgetGuards();
}

/** Enrol a user in 2FA the way the API does, and return the secret. */
function enrol(User $u): string
{
    $secret = Totp::generateSecret();
    $u->forceFill([
        'two_factor_secret' => $secret,
        'two_factor_recovery_codes' => ['AAAAA-BBBBB', 'CCCCC-DDDDD'],
        'two_factor_confirmed_at' => now(),
    ])->save();

    return $secret;
}

// ---------------------------------------------------------------- 2FA: login flow

it('withholds a session and starts mandatory setup when 2FA is not enrolled', function () {
    $u = makeUser(['username' => 'plain', 'password' => bcrypt('secret')]);
    $oldToken = $u->createToken('old-session')->plainTextToken;

    $response = $this->postJson('/api/login', ['username' => 'plain', 'password' => 'secret'])
        ->assertOk()
        ->assertJsonStructure(['challenge', 'secret', 'otpauth_url', 'recovery_codes'])
        ->assertJson(['two_factor_setup_required' => true]);

    expect($response->json('token'))->toBeNull()
        ->and($u->fresh()->hasTwoFactor())->toBeFalse()
        ->and($u->tokens()->count())->toBe(0); // the old token cannot revive after setup

    $this->withHeader('Authorization', 'Bearer '.$oldToken)->getJson('/api/me')->assertStatus(401);
});

it('creates the first session only after mandatory setup is confirmed', function () {
    $u = makeUser(['username' => 'first-login', 'password' => bcrypt('secret')]);
    $setup = $this->postJson('/api/login', ['username' => 'first-login', 'password' => 'secret'])->assertOk();

    $this->postJson('/api/two-factor/setup/confirm', [
        'challenge' => $setup->json('challenge'),
        'code' => '000000',
    ])->assertStatus(422);
    expect($u->fresh()->hasTwoFactor())->toBeFalse();

    $this->postJson('/api/two-factor/setup/confirm', [
        'challenge' => $setup->json('challenge'),
        'code' => Totp::codeAt($setup->json('secret'), intdiv(time(), 30)),
    ])->assertOk()->assertJsonStructure(['token', 'user']);
    expect($u->fresh()->hasTwoFactor())->toBeTrue();
});

it('withholds the token and returns a challenge when 2FA is on', function () {
    $u = makeUser(['username' => 'tfa', 'password' => bcrypt('secret')]);
    enrol($u);

    $r = $this->postJson('/api/login', ['username' => 'tfa', 'password' => 'secret'])->assertOk();
    expect($r->json('two_factor_required'))->toBeTrue()
        ->and($r->json('challenge'))->toBeString()
        ->and($r->json('token'))->toBeNull();   // the password alone must not yield a session
});

it('exchanges a valid TOTP code for a token', function () {
    $u = makeUser(['username' => 'tfa2', 'password' => bcrypt('secret')]);
    $secret = enrol($u);

    $challenge = $this->postJson('/api/login', ['username' => 'tfa2', 'password' => 'secret'])->json('challenge');
    $code = Totp::codeAt($secret, intdiv(time(), 30));

    $this->postJson('/api/two-factor/challenge', ['challenge' => $challenge, 'code' => $code])
        ->assertOk()
        ->assertJsonStructure(['token', 'user']);
});

it('rejects a wrong TOTP code', function () {
    $u = makeUser(['username' => 'tfa3', 'password' => bcrypt('secret')]);
    enrol($u);
    $challenge = $this->postJson('/api/login', ['username' => 'tfa3', 'password' => 'secret'])->json('challenge');

    $this->postJson('/api/two-factor/challenge', ['challenge' => $challenge, 'code' => '000000'])
        ->assertStatus(422);
});

it('accepts a recovery code once, then burns it', function () {
    $u = makeUser(['username' => 'tfa4', 'password' => bcrypt('secret')]);
    enrol($u);

    $c1 = $this->postJson('/api/login', ['username' => 'tfa4', 'password' => 'secret'])->json('challenge');
    $this->postJson('/api/two-factor/challenge', ['challenge' => $c1, 'code' => 'AAAAA-BBBBB'])->assertOk();
    expect($u->fresh()->two_factor_recovery_codes)->toHaveCount(1);

    // the same code must not work a second time
    $c2 = $this->postJson('/api/login', ['username' => 'tfa4', 'password' => 'secret'])->json('challenge');
    $this->postJson('/api/two-factor/challenge', ['challenge' => $c2, 'code' => 'AAAAA-BBBBB'])->assertStatus(422);
});

it('refuses a tampered or expired challenge', function () {
    $u = makeUser(['username' => 'tfa5', 'password' => bcrypt('secret')]);
    $secret = enrol($u);
    $code = Totp::codeAt($secret, intdiv(time(), 30));

    $this->postJson('/api/two-factor/challenge', ['challenge' => 'not-a-real-challenge', 'code' => $code])
        ->assertStatus(422);

    $expired = encrypt(['uid' => $u->id, 'exp' => now()->subMinute()->timestamp]);
    $this->postJson('/api/two-factor/challenge', ['challenge' => $expired, 'code' => $code])
        ->assertStatus(422);
});

// ---------------------------------------------------------------- 2FA: enrolment

it('does not let a setup challenge bypass the normal login challenge endpoint', function () {
    makeUser(['username' => 'purpose-bound', 'password' => bcrypt('secret')]);
    $setup = $this->postJson('/api/login', ['username' => 'purpose-bound', 'password' => 'secret'])->assertOk();

    $this->postJson('/api/two-factor/challenge', [
        'challenge' => $setup->json('challenge'),
        'code' => Totp::codeAt($setup->json('secret'), intdiv(time(), 30)),
    ])->assertStatus(422);
});

it('refuses to disable mandatory 2FA', function () {
    $u = login(makeUser(['password' => bcrypt('secret')]));

    $this->deleteJson('/api/two-factor', ['password' => 'secret'])->assertStatus(403);
    expect($u->fresh()->hasTwoFactor())->toBeTrue();
});

it('never exposes the secret or recovery codes through the user API', function () {
    $u = login(admin(['password' => bcrypt('secret')]));
    enrol($u);

    $body = $this->getJson('/api/me')->assertOk()->json();
    expect(json_encode($body))->not->toContain('two_factor_secret')
        ->and(json_encode($body))->not->toContain('AAAAA-BBBBB');
    expect($body['user']['two_factor_enabled'])->toBeTrue();
});

it('lets an admin reset a locked-out user\'s 2FA', function () {
    $victim = makeUser();
    enrol($victim);
    $victim->createToken('active-session');
    login(admin());

    $this->postJson("/api/users/{$victim->id}/two-factor/reset")->assertOk();
    expect($victim->fresh()->hasTwoFactor())->toBeFalse()
        ->and($victim->tokens()->count())->toBe(0);
});

// ---------------------------------------------------------------- company email domains

it('accepts every domain the real team actually uses', function () {
    login(admin());

    // BOTH epiccrafting spellings are live in production — rejecting either locks staff out
    foreach (['a@bluecascade.org', 'b@epiccraftings.com', 'c@epiccrafting.com'] as $i => $email) {
        $this->postJson('/api/users', [
            'username' => 'newuser'.$i, 'email' => $email, 'role' => 'sales_rep', 'password' => 'secret123',
        ])->assertStatus(201);
    }
});

it('rejects an outside email domain', function () {
    login(admin());

    $this->postJson('/api/users', [
        'username' => 'outsider', 'email' => 'someone@gmail.com', 'role' => 'sales_rep', 'password' => 'secret123',
    ])->assertStatus(422)->assertJsonValidationErrors('email');
});

it('still allows accounts with no email at all', function () {
    login(admin());

    // `ed` and `sami` are real username-only accounts; the domain rule must not make email required
    $this->postJson('/api/users', ['username' => 'noemail', 'role' => 'sales_rep', 'password' => 'secret123'])
        ->assertStatus(201);
});

it('blocks changing an existing user to an outside domain', function () {
    $u = makeUser(['email' => 'x@bluecascade.org']);
    login(admin());

    $this->putJson("/api/users/{$u->id}", ['email' => 'x@hotmail.com'])->assertStatus(422);
    expect($u->fresh()->email)->toBe('x@bluecascade.org');
});

// ---------------------------------------------------------------- impersonation

it('lets an admin view as another user and come back', function () {
    $target = makeUser(['username' => 'repguy']);
    login(admin());

    $r = $this->postJson("/api/users/{$target->id}/impersonate")->assertOk();
    expect($r->json('user.username'))->toBe('repguy')
        ->and($r->json('impersonator'))->not->toBeNull();

    // the impersonation token really authenticates as the target
    asToken($r->json('token'));
    $this->withHeader('Authorization', 'Bearer '.$r->json('token'))
        ->getJson('/api/me')->assertOk()
        ->assertJson(['user' => ['username' => 'repguy'], 'impersonating' => true]);
});

it('forbids a non-admin from impersonating', function () {
    $target = makeUser();
    login(makeUser(['role' => 'sales_rep']));

    $this->postJson("/api/users/{$target->id}/impersonate")->assertStatus(403);
});

it('blocks credential changes from inside an impersonated session', function () {
    $target = makeUser(['username' => 'victim']);
    $a = admin();
    login($a);
    $token = $this->postJson("/api/users/{$target->id}/impersonate")->json('token');

    // borrowed session must not be able to re-enrol 2FA, change passwords, or chain impersonation
    asToken($token);
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/two-factor/enable')->assertStatus(403);
    asToken($token);
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->putJson("/api/users/{$target->id}/password", ['password' => 'hacked123'])->assertStatus(403);
    asToken($token);
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson("/api/users/{$a->id}/impersonate")->assertStatus(403);
});

it('can always stop impersonating from inside the session', function () {
    $target = makeUser();
    login(admin());
    $token = $this->postJson("/api/users/{$target->id}/impersonate")->json('token');

    asToken($token);
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/impersonate/stop')->assertOk();
});

// ---------------------------------------------------------------- quote filters

it('filters quotes by company and date range', function () {
    login(admin());
    $old = makeQuote(['company_name' => 'Signarama Ankeny', 'sales_rep' => '']);
    $old->forceFill(['created_at' => now()->subDays(30)])->save();
    makeQuote(['company_name' => 'Epic Craftings', 'sales_rep' => '']);

    expect($this->getJson('/api/quotes?company=Ankeny')->assertOk()->json())->toHaveCount(1);

    // date_to is inclusive of the whole day — today's quote must be inside "to today"
    $today = $this->getJson('/api/quotes?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
        ->assertOk()->json();
    expect($today)->toHaveCount(1)
        ->and($today[0]['company_name'])->toBe('Epic Craftings');

    expect($this->getJson('/api/quotes?date_from='.now()->subDays(40)->toDateString())->assertOk()->json())
        ->toHaveCount(2);
});

// ---------------------------------------------------------------- account rename

it('renames an account, keeping its password and role', function () {
    $u = makeUser(['username' => 'test@123.com', 'email' => 'test@123.com', 'role' => 'admin', 'password' => bcrypt('secret')]);

    // Artisan::call, not $this->artisan(...): the assertion API needs Mockery, which is not
    // installed here (see tests/Pest.php). The exit code is the same contract.
    $exit = Illuminate\Support\Facades\Artisan::call('users:rename', [
        'from' => 'test@123.com',
        '--username' => 'sami.ullah',
        '--email' => 'sami.ullah@bluecascade.org',
        '--full-name' => 'Sami Ullah',
    ]);
    expect($exit)->toBe(0);

    $u->refresh();
    expect($u->username)->toBe('sami.ullah')
        ->and($u->email)->toBe('sami.ullah@bluecascade.org')
        ->and($u->role)->toBe('admin')                              // role untouched
        ->and(Illuminate\Support\Facades\Hash::check('secret', $u->password))->toBeTrue();  // password untouched

    // and the renamed account can actually sign in under its new identity
    $this->postJson('/api/login', ['username' => 'sami.ullah', 'password' => 'secret'])->assertOk();
});

it('refuses to rename an account onto a non-company domain', function () {
    $u = makeUser(['username' => 'test@123.com', 'email' => 'test@123.com']);

    // bluecascde.org (missing the 'a') is NOT the company domain — the command must not create
    // an address that the app's own validation would reject
    $exit = Illuminate\Support\Facades\Artisan::call('users:rename', ['from' => 'test@123.com', '--email' => 'sami.ullah@bluecascde.org']);
    expect($exit)->not->toBe(0);

    expect($u->fresh()->email)->toBe('test@123.com');
});

it('is idempotent — a second identical rename changes nothing', function () {
    makeUser(['username' => 'olduser', 'email' => 'old@bluecascade.org']);

    expect(Illuminate\Support\Facades\Artisan::call('users:rename', ['from' => 'olduser', '--username' => 'newuser']))->toBe(0);
    expect(Illuminate\Support\Facades\Artisan::call('users:rename', ['from' => 'newuser', '--username' => 'newuser']))->toBe(0);

    expect(App\Models\User::where('username', 'newuser')->count())->toBe(1);
});

// ---------------------------------------------------------------- stored-file XSS guard

it('serves uploaded files with a CSP that cannot execute scripts', function () {
    Illuminate\Support\Facades\Storage::fake('public');
    Illuminate\Support\Facades\Storage::disk('public')->put(
        'artwork/probe.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    );

    $res = $this->get('/storage/artwork/probe.svg')->assertOk();

    // SVG is still SERVED — the guard must not remove a supported upload type
    expect($res->headers->get('Content-Type'))->toContain('svg');
    // ...but sandboxed, so a <script> inside it can never run in this origin (where the token lives)
    $csp = (string) $res->headers->get('Content-Security-Policy');
    expect($csp)->toContain('sandbox')
        ->and($csp)->toContain("default-src 'none'");
    expect($res->headers->get('X-Content-Type-Options'))->toBe('nosniff');
    // the SPA still has to be able to read these cross-origin for the PNG/PDF export
    expect($res->headers->get('Access-Control-Allow-Origin'))->toBe('*');
});

it('keeps a missing file a clean CORS-bearing 404, not an opaque error', function () {
    Illuminate\Support\Facades\Storage::fake('public');
    $res = $this->getJson('/storage/artwork/nope.png')->assertStatus(404);
    expect($res->headers->get('Access-Control-Allow-Origin'))->toBe('*');
});

// ---------------------------------------------------- price approval is oversight, not self-serve

it('refuses to let a sales rep approve a price', function () {
    $rep   = makeUser(['role' => 'sales_rep']);
    $quote = makeQuote(['created_by' => $rep->id, 'price_approved' => false]);

    login($rep);
    $this->patchJson("/api/quotes/{$quote->quote_id}", ['price_approved' => true])
        ->assertStatus(403);

    expect((bool) $quote->fresh()->price_approved)->toBeFalse();
});

it('refuses to let a sales rep unlock a quote', function () {
    $rep   = makeUser(['role' => 'sales_rep']);
    $quote = makeQuote(['created_by' => $rep->id, 'approval_locked' => true]);

    login($rep);
    $this->patchJson("/api/quotes/{$quote->quote_id}", ['approval_locked' => false])
        ->assertStatus(403);

    expect((bool) $quote->fresh()->approval_locked)->toBeTrue();
});

it('still lets a manager approve, and stamps who did it', function () {
    $mgr   = makeUser(['role' => 'manager', 'full_name' => 'Dana Lane']);
    $quote = makeQuote(['price_approved' => false]);

    login($mgr);
    $this->patchJson("/api/quotes/{$quote->quote_id}", ['price_approved' => true])->assertOk();

    $quote->refresh();
    expect((bool) $quote->price_approved)->toBeTrue()
        ->and($quote->approved_by)->toBe('Dana Lane')
        ->and($quote->approved_at)->not->toBeNull();
});

// C1 GUARD: the frontend PATCHes the whole quote back on every save, so a rep re-sending the
// value it already has must NOT start failing. The gate is on the CHANGE, not on the key.
it('lets a sales rep save a quote that merely re-sends the unchanged approval flags', function () {
    $rep   = makeUser(['role' => 'sales_rep']);
    $quote = makeQuote([
        'created_by' => $rep->id, 'price_approved' => false, 'approval_locked' => true,
    ]);

    login($rep);
    $this->patchJson("/api/quotes/{$quote->quote_id}", [
        'price_approved'  => false,      // unchanged
        'approval_locked' => true,       // unchanged
        'client_name'     => 'Edited By Rep',
    ])->assertOk();

    expect($quote->fresh()->client_name)->toBe('Edited By Rep');
});

/* ── Email-delivered sign-in codes (Rod, 2026-08-05) ─────────────────────────────────────────
   The account keeps its authenticator secret and recovery codes: mail is the one factor here
   that can fail for reasons the person cannot see, and this is the login path. */

it('emails a code to an email-channel account and accepts it', function () {
    Illuminate\Support\Facades\Mail::fake();
    $u = makeUser(['username' => 'rod', 'email' => 'rod@epiccraftings.com', 'password' => bcrypt('secret')]);
    $u->forceFill([
        'two_factor_secret' => App\Support\Totp::generateSecret(),
        'two_factor_confirmed_at' => now(),
        'two_factor_channel' => 'email',
    ])->save();

    $login = $this->postJson('/api/login', ['username' => 'rod', 'password' => 'secret'])->assertOk()->json();
    expect($login['two_factor_required'])->toBeTrue()
        ->and($login['channel'])->toBe('email')
        ->and($login['sent_to'])->toBe('r***@epiccraftings.com');   // masked, never the full address

    Illuminate\Support\Facades\Mail::assertSentCount(1);

    // The code is never echoed by the API — it only exists in the message and as a hash.
    expect($login)->not->toHaveKey('code');
    $u->refresh();
    expect($u->two_factor_email_code)->not->toBeEmpty()
        ->and($u->two_factor_email_code)->not->toMatch('/^\d{6}$/');   // stored hashed
});

it('does not email anything for an authenticator account', function () {
    Illuminate\Support\Facades\Mail::fake();
    $u = makeUser(['password' => bcrypt('secret')]);
    $u->forceFill(['two_factor_secret' => App\Support\Totp::generateSecret(), 'two_factor_confirmed_at' => now()])->save();

    $login = $this->postJson('/api/login', ['username' => $u->username, 'password' => 'secret'])->assertOk()->json();
    expect($login['channel'])->toBe('totp')->and($login)->not->toHaveKey('sent_to');
    Illuminate\Support\Facades\Mail::assertNothingSent();
});

it('rejects a wrong emailed code and burns it after five attempts', function () {
    $u = makeUser(['email' => 'rod@epiccraftings.com']);
    $u->forceFill([
        'two_factor_secret' => App\Support\Totp::generateSecret(),
        'two_factor_confirmed_at' => now(),
        'two_factor_channel' => 'email',
        'two_factor_email_code' => Illuminate\Support\Facades\Hash::make('123456'),
        'two_factor_email_expires_at' => now()->addMinutes(10),
    ])->save();

    for ($i = 0; $i < 5; $i++) {
        expect(App\Support\EmailOtp::verify($u->fresh(), '000000'))->toBeFalse();
    }
    // The real code no longer works: the attempts are spent and the code is gone.
    expect(App\Support\EmailOtp::verify($u->fresh(), '123456'))->toBeFalse()
        ->and($u->fresh()->two_factor_email_code)->toBeNull();
});

it('refuses an expired emailed code', function () {
    $u = makeUser(['email' => 'rod@epiccraftings.com']);
    $u->forceFill([
        'two_factor_email_code' => Illuminate\Support\Facades\Hash::make('123456'),
        'two_factor_email_expires_at' => now()->subMinute(),
    ])->save();

    expect(App\Support\EmailOtp::verify($u->fresh(), '123456'))->toBeFalse();
});

it('accepts an emailed code once and never again', function () {
    $u = makeUser(['email' => 'rod@epiccraftings.com']);
    $u->forceFill([
        'two_factor_email_code' => Illuminate\Support\Facades\Hash::make('123456'),
        'two_factor_email_expires_at' => now()->addMinutes(10),
    ])->save();

    expect(App\Support\EmailOtp::verify($u->fresh(), '123456'))->toBeTrue()
        ->and(App\Support\EmailOtp::verify($u->fresh(), '123456'))->toBeFalse();
});

it('keeps the authenticator and recovery codes working on an email-channel account', function () {
    // The point of this one: switching channel must not be able to lock the person out when mail
    // breaks. Their existing factors stay valid.
    $u = makeUser(['email' => 'rod@epiccraftings.com', 'password' => bcrypt('secret')]);
    $u->forceFill([
        'two_factor_secret' => App\Support\Totp::generateSecret(),
        'two_factor_recovery_codes' => ['AAAAA-BBBBB'],
        'two_factor_confirmed_at' => now(),
        'two_factor_channel' => 'email',
    ])->save();

    Illuminate\Support\Facades\Mail::fake();
    $challenge = $this->postJson('/api/login', ['username' => $u->username, 'password' => 'secret'])
        ->assertOk()->json('challenge');

    $this->postJson('/api/two-factor/challenge', ['challenge' => $challenge, 'code' => 'AAAAA-BBBBB'])
        ->assertOk()->assertJsonStructure(['token']);
});

it('will not resend a code for an authenticator account', function () {
    Illuminate\Support\Facades\Mail::fake();
    $u = makeUser(['password' => bcrypt('secret')]);
    $u->forceFill(['two_factor_secret' => App\Support\Totp::generateSecret(), 'two_factor_confirmed_at' => now()])->save();

    $challenge = $this->postJson('/api/login', ['username' => $u->username, 'password' => 'secret'])
        ->assertOk()->json('challenge');

    $this->postJson('/api/two-factor/resend', ['challenge' => $challenge])->assertStatus(422);
    Illuminate\Support\Facades\Mail::assertNothingSent();
});
