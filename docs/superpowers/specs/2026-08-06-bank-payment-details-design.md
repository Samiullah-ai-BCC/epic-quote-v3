# SPEC: bank details as a payment option on the proposal

Status: APPROVED   Owner: Sam   Date: 2026-08-06

## 1. Intent

Every Shopify payment costs 3% of the quote. The company would rather be paid by wire
transfer, which costs nothing. So a proposal must be able to show the company's bank
details instead of — or as well as — the Shopify pay button, and the rep decides which,
per quote.

"As well as" is here because the manager asked for it, not because it is expected to be
the common case: given both, most customers will click the orange button and the 3% is
paid anyway. It is built because it was asked for, and it is the option most likely to be
dropped after it is seen in use.

## 2. Behaviour contract

GIVEN a quote with no payment choice recorded (every quote that exists today)
WHEN the proposal is previewed, downloaded or viewed
THEN it behaves exactly as it does now: the orange pay bar appears if a Shopify link
exists, and nothing else changes.

GIVEN a rep on the preview step
WHEN they pick "Bank transfer"
THEN the bank block replaces the orange bar in the totals column, and the choice is saved
on the quote.

GIVEN a rep picks "Both"
WHEN the sheet renders
THEN the orange bar keeps its current position and the bank block sits directly beneath
it. No other element on the sheet moves.

GIVEN a rep picks bank or both
AND no bank details have been saved in settings
WHEN the sheet renders
THEN no bank block prints, and the controls column tells the rep why. A half-empty block
on a customer's proposal is worse than none.

GIVEN a quote showing the bank block
WHEN it is exported to PNG or PDF
THEN the block appears in the file, because it is ordinary sheet content. The PDF's
clickable annotation still targets `data-pay-link` and still exists only when Shopify is
showing — bank text is not a link.

GIVEN an admin in settings
WHEN they change the bank details
THEN every quote rendered afterwards shows the new details. Quotes already downloaded are
unaffected; they are files.

GIVEN a non-admin
WHEN they open settings
THEN the bank fields are visible but not editable.

## 3. The saved details

One `Setting` row, key `bank_details`, five string fields:

| field | seeded value |
|---|---|
| `title` | Epic Craftings Inc. (Bank of America) |
| `account_number` | 444030406654 |
| `routing_number` | 026009593 |
| `routing_note` | Wire Transfer |
| `address` | 101 E Luzerne St # B Philadelphia, PA 19124 4201 |

Five discrete fields rather than one block of text, for two reasons: an admin correcting
the account number cannot break the layout while doing it, and the bold-label styling is
applied by the sheet rather than retyped by a human each time.

Read: anyone who can open a quote. Write: admins only, through the existing
`SettingsController` beside the logo and the status list. No new table, no new auth model.

## 4. The per-quote choice

One new column on `quotes`: `payment_display`, one of `shopify` / `bank` / `both`.

NULL means Shopify only. That is not a default chosen for tidiness — it is the C1 guard:
every quote in the system today has no value, and NULL must reproduce today's behaviour
exactly, so shipping this changes no existing quote.

The control is a three-way choice in the controls column, directly above the existing
payment-link buttons, saved on the quote like any other quote-level field.

## 5. What renders

Last sign page, totals column, in the slot the orange bar occupies today.

Orange `Bank Details:` header bar — the same orange as the pay button, which is what lets
the two stack as one unit when both are shown — over a black-bordered box of three centred
lines:

```
Title: {title}
Account number: {account_number} / Routing Number: {routing_number} ({routing_note})
Address: {address}
```

Labels bold, values plain.

## 6. Vertical slice

- [ ] UI — the three-way control; the bank block on the sheet; the settings fields
- [ ] Endpoint — extend `SettingsController` (get/set `bank_details`); `payment_display`
      accepted on the existing quote update
- [ ] Persistence — `Setting` row; `payment_display` column with a migration
- [ ] Validation — server-side: admin-only write on the setting; `payment_display`
      restricted to the three known values. Client-side is decoration.
- [ ] Error state — details missing while bank/both is selected: sheet prints nothing,
      controls column explains
- [ ] Empty state — a fresh install with no details saved behaves as "Shopify only"
      regardless of the per-quote choice

## 7. Impact map

`payment_display` is new, so nothing reads it yet. The bank block lands inside the sheet
DOM that these already consume, and each must be checked rather than assumed:

- `frontend/src/components/Proposal.jsx` — the sheet itself; the block renders here,
  beside the existing `data-pay-link` bar
- `frontend/src/components/generator/PreviewStep.jsx` — passes quote-level props into
  each page
- `frontend/src/pages/Generator.jsx` — owns the quote and saves the choice
- `frontend/src/pages/generator/components/LivePreviewPanel.jsx` and
  `hooks/useLivePreview.js` — the wizard's live preview renders the same component
- `frontend/src/components/quotes/ViewProposalImage.jsx` — the read-only "View" modal
- `frontend/src/pages/generator/hooks/usePageCapture.js` — capture paths for PNG/PDF and
  the version snapshot; no change expected, to be confirmed rather than assumed
- `backend/app/Http/Controllers/Api/SettingsController.php`, `Api/QuoteController.php`,
  `app/Models/Quote.php`, `app/Models/Setting.php`

SYSTEM_MAP.md gains a `payment_display` entry in the same commit.

## 8. Money questions

**Could this bill the wrong amount?** No — nothing here computes or moves money. The bank
block is text. The risk is the opposite: a customer paying to details that are wrong or
stale. Hence admin-only writes and one source of truth.

**Could a customer see another company's details?** The setting is company-wide and this
is a single-company install, so there is nothing to leak across. If the app ever becomes
multi-tenant, this setting becomes tenant-scoped and that is a breaking change worth
writing down now.

**Could data be lost?** No deletion path is added. Clearing the details makes future
sheets print no block; already-exported files are unaffected.

## 9. Known gap, deliberately out of scope

**A bank payment will not mark a quote paid.** `ShopifyWebhookController` flips a quote's
status when Shopify confirms a payment. A wire transfer arrives at the bank, not at this
app, so a bank-paid quote stays "unpaid" until a human says otherwise. Nothing in this
spec closes that, and it will be noticed in the first week of real use. It needs its own
decision — a manual "mark as paid" action, or a reconciliation import — and is not
prototype work.

## 10. Also out of scope

Per-quote overrides of the details themselves; more than one bank account; IBAN, SWIFT or
currency handling beyond the five fields; any reconciliation of received transfers.

## 11. Proof plan

- Backend: `payment_display` rejects an unknown value; a non-admin write to
  `bank_details` is refused
- Frontend: with NULL `payment_display`, a quote renders byte-identically to before —
  this is the regression that matters most
- Manual: pick each of the three options on a real quote; download the PDF for each;
  confirm the orange bar's clickable annotation still lands on the bar in `shopify` and
  `both`, and is absent in `bank`

## 12. Rollout

Migration for `payment_display`; a seeded `bank_details` setting carrying the values in
section 3. Both remotes. No Dockerfile change, so no Render rebuild.
