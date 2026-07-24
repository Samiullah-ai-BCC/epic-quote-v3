<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Representative;
use Illuminate\Console\Command;

/**
 * Import our own companies + contacts from an Airtable customer-list CSV (#9).
 *
 *   php artisan companies:import path/to/customers.csv
 *   php artisan companies:import path/to/customers.csv --dry-run
 *
 * Column headers are matched by name (case-insensitive), so the exact Airtable
 * export order doesn't matter. A "Company" column is required; Client / Phone /
 * Email / Address are optional. Idempotent: companies dedupe by name (case-
 * insensitive), contacts dedupe by (company, name) — re-running never duplicates,
 * and it backfills a blank phone/email/address on rows that already exist.
 */
class ImportCompanies extends Command
{
    protected $signature = 'companies:import {file : path to the Airtable CSV} {--dry-run : parse + report, write nothing}';

    protected $description = 'Import companies + contacts from an Airtable customer CSV';

    public function handle(): int
    {
        $file = $this->argument('file');
        if (!is_file($file)) {
            $this->error("File not found: {$file}");
            return self::FAILURE;
        }
        $fh = fopen($file, 'r');
        if (!$fh) {
            $this->error("Could not open: {$file}");
            return self::FAILURE;
        }

        // strip a UTF-8 BOM off the first header so "name" still matches
        $headers = array_map(fn ($h) => mb_strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h))), fgetcsv($fh) ?: []);
        // Exact match first, then a CONTAINS fallback. An exact-only lookup meant a sheet whose
        // column reads "Billing Address" or "Address Line 1" silently imported no addresses at
        // all — and because only the company column is required, the run reported success while
        // every address was dropped. That is the "the address is in the CSV but never shows up"
        // report: the data was fine, the header just wasn't one of four hard-coded spellings.
        // A column is claimed by the FIRST field that matches it and is then off the table.
        // Without that, the loose fallback below let the client alias 'name' match the header
        // "Company Name" — importing every company name as a contact person. Exact matches for
        // ALL fields are resolved before any loose match, so a precise header always outranks a
        // substring guess no matter what order the columns appear in.
        $used = [];
        $exact = function (array $names) use ($headers, &$used) {
            foreach ($names as $n) {
                $i = array_search($n, $headers, true);
                if ($i !== false && !isset($used[$i])) {
                    $used[$i] = true;
                    return $i;
                }
            }
            return null;
        };
        $loose = function (array $names) use ($headers, &$used) {
            foreach ($names as $n) {
                foreach ($headers as $i => $h) {
                    if ($h !== '' && !isset($used[$i]) && str_contains($h, $n)) {
                        $used[$i] = true;
                        return $i;
                    }
                }
            }
            return null;
        };
        $ALIASES = [
            'company' => ['company', 'company name', 'companyname', 'customer', 'retail company'],
            'client'  => ['client name', 'clientname', 'contact name', 'contact person', 'client'],
            'phone'   => ['phone', 'phone number', 'tel', 'telephone', 'mobile'],
            'email'   => ['email', 'e-mail', 'email address'],
            'address' => ['address', 'mailing address', 'company address', 'street address', 'street', 'address 1', 'address line 1', 'location'],
            'city'    => ['city', 'town'],
            'state'   => ['state', 'province', 'region'],
            'zip'     => ['zip', 'zipcode', 'zip code', 'postal code', 'postcode'],
        ];
        $ci = [];
        foreach ($ALIASES as $k => $names) {
            $ci[$k] = $exact($names);
        }
        foreach ($ALIASES as $k => $names) {
            if ($ci[$k] === null) {
                $ci[$k] = $loose($names);
            }
        }
        if ($ci['address'] === null && $ci['city'] === null) {
            $this->warn('No address column found — addresses will NOT be imported.');
            $this->warn('Headers seen: '.implode(' | ', $headers));
        }
        if ($ci['company'] === null) {
            $this->error('No "Company" column found. Headers seen: '.implode(', ', $headers));
            return self::FAILURE;
        }

        $dry = (bool) $this->option('dry-run');
        $rows = 0; $newCo = 0; $updCo = 0; $newRep = 0; $updRep = 0;
        $seenCo = [];   // dry-run in-memory dedupe so preview counts match a real run
        $seenRep = [];

        while (($r = fgetcsv($fh)) !== false) {
            $get = fn (string $k) => $ci[$k] !== null ? trim((string) ($r[$ci[$k]] ?? '')) : '';
            $company = $get('company');
            if ($company === '') {
                continue;   // skip rows with no company
            }
            $rows++;
            $client = $get('client');
            $phone = $get('phone');
            $email = $get('email');
            // Compose "street, city, ST zip" from whatever parts the sheet actually has.
            $address = $get('address');
            $cityBit = trim(implode(' ', array_filter([$get('state'), $get('zip')])));
            $address = trim(implode(', ', array_filter([$address, $get('city'), $cityBit])), ', ');

            // company — dedupe by lower(name), with whitespace NORMALISED. Real rows carry double
            // spaces and non-breaking spaces ("Signarama  Redmond", "\u{00A0}Valley Sign"), and a
            // raw comparison treats those as different companies: the import creates a second row
            // and the address lands on the copy nobody looks up. 13 such names exist today.
            $company = $this->norm($company);
            $coKey = mb_strtolower($company);
            $co = Company::whereRaw("LOWER(TRIM(REPLACE(REPLACE(name, CHAR(9), ' '), '\u{00A0}', ' '))) = ?", [$coKey])->first()
                ?? Company::whereRaw('LOWER(name) = ?', [$coKey])->first();
            if (!$co) {
                if (!isset($seenCo[$coKey])) {
                    $newCo++;
                    $seenCo[$coKey] = true;
                }
                if (!$dry) {
                    $co = Company::create(['name' => $company, 'address' => $address, 'phone' => '', 'email' => '']);
                }
            } elseif ($address !== '' && !$co->address) {
                $updCo++;
                if (!$dry) {
                    $co->update(['address' => $address]);
                }
            }

            // contact — dedupe by (company, lower(name)); backfill blanks on an existing one
            if ($client !== '' && ($co || $dry)) {
                $repKey = $coKey.'|'.mb_strtolower($client);
                $rep = $co ? Representative::where('company_id', $co->id)
                    ->whereRaw('LOWER(name) = ?', [mb_strtolower($client)])->first() : null;
                if (!$rep) {
                    if (!isset($seenRep[$repKey])) {
                        $newRep++;
                        $seenRep[$repKey] = true;
                    }
                    if (!$dry && $co) {
                        Representative::create(['company_id' => $co->id, 'name' => $client, 'phone' => $phone, 'email' => $email]);
                    }
                } else {
                    $patch = [];
                    if ($phone !== '' && !$rep->phone) $patch['phone'] = $phone;
                    if ($email !== '' && !$rep->email) $patch['email'] = $email;
                    if ($patch) {
                        $updRep++;
                        if (!$dry) $rep->update($patch);
                    }
                }
            }
        }
        fclose($fh);

        $this->info("Rows read: {$rows}");
        $this->info("Companies — new: {$newCo}, address-filled: {$updCo}");
        $this->info("Contacts  — new: {$newRep}, backfilled: {$updRep}");
        if ($dry) {
            $this->warn('Dry run — nothing was written. Re-run without --dry-run to import.');
        }
        return self::SUCCESS;
    }

    /** Collapse tabs, non-breaking spaces and runs of whitespace to single spaces. */
    private function norm(string $s): string
    {
        return trim(preg_replace('/\s+/u', ' ', str_replace(["\u{00A0}", "\t"], ' ', $s)));
    }
}
