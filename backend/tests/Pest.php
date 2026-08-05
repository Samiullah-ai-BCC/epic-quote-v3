<?php

use Illuminate\Support\Facades\Artisan;

// Feature tests boot the app + a fresh in-memory sqlite per test. Migrations run via
// Artisan::call (NOT RefreshDatabase — its PendingCommand mocks console output with
// Mockery, which isn't installed here; the :memory: database is new every test anyway).
pest()->extend(Tests\TestCase::class)
    ->beforeEach(function () { Artisan::call('migrate'); })
    ->in('Feature');

// ---- shared builders (plain helpers, not factories — the models are simple) ----

// Authenticate the test client as this user with a REAL Sanctum token (no mocking —
// the request walks the same auth path production does).
function login(App\Models\User $user): App\Models\User
{
    // Protected routes require confirmed 2FA in production. Test helpers must create the same
    // kind of valid session instead of silently bypassing the policy with a raw Sanctum token.
    if (!$user->hasTwoFactor()) {
        $user->forceFill([
            'two_factor_secret' => App\Support\Totp::generateSecret(),
            'two_factor_recovery_codes' => ['TESTA-CODEA', 'TESTB-CODEB'],
            'two_factor_confirmed_at' => now(),
        ])->save();
    }
    test()->withHeader('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);
    // A test that logs in as a SECOND person mid-way — "the rep hides it; does the admin still see
    // it?" — was silently answered by the FIRST person: the guard caches the user it resolved on
    // the previous request, so the new bearer token was ignored and the assertions passed or failed
    // for the wrong account. Forgetting the guards makes the next request re-resolve from the
    // header that is actually set.
    app('auth')->forgetGuards();
    return $user;
}

function makeUser(array $attrs = []): App\Models\User
{
    static $n = 0;
    $n++;
    return App\Models\User::create(array_merge([
        'username'  => 'user'.$n,
        'full_name' => 'User '.$n,
        'password'  => bcrypt('secret'),
        'role'      => 'sales_rep',
    ], $attrs));
}

function makeQuote(array $attrs = []): App\Models\Quote
{
    static $q = 100;
    $q++;
    return App\Models\Quote::create(array_merge([
        'quote_id'     => 'TEST'.$q,
        'quote_num'    => $q,
        'order_id'     => '',
        'company_name' => 'Test Co',
        'client_name'  => 'Tester',
        'contact'      => '',
        'email'        => '',
        'address'      => '',
        'job_name'     => '',
        'status'       => 'To Do',
        'tags'         => [],
        'price'        => 0,
    ], $attrs));
}
