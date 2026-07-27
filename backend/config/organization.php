<?php

return [
    /*
    |---------------------------------------------------------------------------
    | Allowed sign-in email domains
    |---------------------------------------------------------------------------
    | Accounts may only be created or updated with an email at one of these
    | domains. Company-only access, enforced server-side.
    |
    | BOTH epiccrafting.com AND epiccrafting_s_.com are listed on purpose. The live
    | user table contains both spellings — rod@epiccrafting.com (singular) sits
    | alongside faraz@epiccrafting_s_.com (plural) — so allowing only the plural
    | form would have locked existing staff out of their own accounts the moment
    | anyone edited their profile. If the singular domain is ever retired, remove
    | it here AFTER migrating those addresses, not before.
    |
    | Override per environment with ALLOWED_EMAIL_DOMAINS="a.com,b.org".
    */
    'allowed_email_domains' => array_values(array_filter(array_map(
        fn ($d) => strtolower(trim($d)),
        explode(',', (string) env('ALLOWED_EMAIL_DOMAINS', 'bluecascade.org,epiccraftings.com,epiccrafting.com'))
    ))),

    /*
    | Shown on the 2FA enrolment screen and inside the authenticator app entry.
    */
    'totp_issuer' => env('TOTP_ISSUER', 'Epic Craftings'),
];
