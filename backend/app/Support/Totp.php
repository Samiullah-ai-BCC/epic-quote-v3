<?php

namespace App\Support;

/**
 * RFC 6238 TOTP — the algorithm every authenticator app (Google Authenticator, Authy, 1Password,
 * Microsoft Authenticator) implements. Written here rather than pulled in as a dependency: it is
 * ~60 lines of well-specified maths, and a self-contained implementation cannot break the build
 * on a Render deploy because a package resolved differently.
 *
 * Defaults are the ones authenticator apps assume when a QR code omits them: SHA1, 6 digits,
 * 30-second step. Do not "modernise" these to SHA256 — the apps will silently produce codes that
 * never validate.
 */
final class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';   // RFC 4648 base32
    private const DIGITS = 6;
    private const PERIOD = 30;

    /** A fresh base32 secret. 20 bytes = 160 bits, the RFC 4226 recommended length. */
    public static function generateSecret(int $bytes = 20): string
    {
        $out = '';
        $raw = random_bytes($bytes);
        // encode base32 without padding (authenticator apps dislike '=' inside otpauth URIs)
        $bits = '';
        for ($i = 0; $i < strlen($raw); $i++) {
            $bits .= str_pad(decbin(ord($raw[$i])), 8, '0', STR_PAD_LEFT);
        }
        foreach (str_split($bits, 5) as $chunk) {
            if (strlen($chunk) < 5) {
                $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            }
            $out .= self::ALPHABET[bindec($chunk)];
        }
        return $out;
    }

    /** The code for a given counter window; used for both generation and verification. */
    public static function codeAt(string $secret, int $counter): string
    {
        $key = self::base32Decode($secret);
        if ($key === '') {
            return '';
        }
        // counter as a 64-bit big-endian integer
        $binCounter = pack('N*', 0, $counter);
        $hash = hash_hmac('sha1', $binCounter, $key, true);
        // RFC 4226 dynamic truncation
        $offset = ord($hash[19]) & 0x0F;
        $value = ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF);
        return str_pad((string) ($value % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    /**
     * Verify a user-entered code.
     *
     * `$window` accepts codes from one step either side of now (±30s). Phone clocks drift and a
     * rep typing the last two digits as the code rolls over is not an attacker — a zero window
     * produces support tickets, not security. Comparison is timing-safe.
     */
    public static function verify(string $secret, string $code, int $window = 1): bool
    {
        $code = preg_replace('/\D/', '', $code);
        if ($secret === '' || strlen((string) $code) !== self::DIGITS) {
            return false;
        }
        $now = intdiv(time(), self::PERIOD);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::codeAt($secret, $now + $i), (string) $code)) {
                return true;
            }
        }
        return false;
    }

    /** The otpauth:// URI an authenticator app scans as a QR code. */
    public static function uri(string $secret, string $account, string $issuer): string
    {
        return 'otpauth://totp/'.rawurlencode($issuer).':'.rawurlencode($account)
            .'?secret='.$secret
            .'&issuer='.rawurlencode($issuer)
            .'&algorithm=SHA1&digits='.self::DIGITS.'&period='.self::PERIOD;
    }

    private static function base32Decode(string $b32): string
    {
        $b32 = strtoupper(preg_replace('/[^A-Z2-7]/i', '', $b32));
        if ($b32 === '') {
            return '';
        }
        $bits = '';
        for ($i = 0; $i < strlen($b32); $i++) {
            $pos = strpos(self::ALPHABET, $b32[$i]);
            if ($pos === false) {
                return '';
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $out .= chr(bindec($byte));
            }
        }
        return $out;
    }
}
