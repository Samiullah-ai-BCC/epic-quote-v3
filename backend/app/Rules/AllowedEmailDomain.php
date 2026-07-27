<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Company-only email addresses (config/organization.php).
 *
 * Deliberately passes on an EMPTY value: `ed` and `sami` are real, working accounts with no
 * email at all, and they sign in by username. Making the domain rule imply "email is required"
 * would have blocked every future edit to those two accounts — a restriction nobody asked for,
 * arriving as a side effect of one that was. `nullable` on the field governs presence; this
 * rule governs only the domain of a value that IS present.
 */
class AllowedEmailDomain implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $email = strtolower(trim((string) $value));
        if ($email === '') {
            return;
        }

        $domains = (array) config('organization.allowed_email_domains', []);
        if ($domains === []) {
            return;   // unconfigured = unrestricted; never lock an install out by misconfiguration
        }

        $at = strrpos($email, '@');
        $domain = $at === false ? '' : substr($email, $at + 1);

        if (!in_array($domain, $domains, true)) {
            $fail('Only company email addresses are allowed ('.implode(', ', array_map(fn ($d) => '@'.$d, $domains)).').');
        }
    }
}
