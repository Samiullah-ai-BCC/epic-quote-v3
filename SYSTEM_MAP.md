# SYSTEM MAP — what connects to what

**LAW:** before editing anything listed here, read its entry and verify EVERY dependent in the
same change. A local fix that breaks a sibling is not a fix. Adding a feature = adding its node
here, in the same commit.

**Why this file exists:** every serious regression in this project has the same shape — a change
that was correct in isolation and wrong in the graph. The scroll chain below was broken twice in
two days because nothing wrote down that a wrapper `<div>` is load-bearing. Nodes, not tasks.

---

## LAYOUT / SCROLL CHAIN — SOURCE OF TRUTH: `frontend/src/components/Layout.jsx` + `index.css` `.main/.fill-page/.grid-wrap`

The page-fill chain is **height-dependent and therefore fragile**: each link needs its parent to
have a DEFINITE height, or the whole thing silently collapses to content height.

```
div.h-screen  →  <main> (flex-1, overflow:auto, definite height)
                    →  .fill-page  (height:100%  ← NEEDS a definite-height parent)
                        →  .grid-wrap (flex:1, min-height:0, overflow:auto)
                            → the table's OWN horizontal + vertical scrollbars live here
```

**INVARIANT: never insert a plain (auto-height) wrapper between `<main>` and `.fill-page`.**
Doing so makes `height:100%` resolve against auto, `.grid-wrap` grows to full content height
(~1499px), and the table's horizontal scrollbar lands far below the fold — the user sees it as
"the bottom slider has vanished, I have to scroll all the way down".
- Broken this way by: the impersonation-banner wrapper (fixed in `be3119a`).
- Anything added to the shell (banners, toolbars) goes as a SIBLING of `<main>`, never a wrapper.
- Dependents: every page using `.fill-page` — `AllQuotes`, and any future grid page.
- Check after touching: `grid-wrap.clientHeight` must be < its `scrollHeight`, and its
  `getBoundingClientRect().bottom` must be ≤ `window.innerHeight`.

## quote.price / grand total — SOURCE OF TRUTH: the wizard price (`quotes.price`)
Displayed by: `Proposal.jsx` (`unitPrice`, `totalPrice`, `subtotal`, `dep1/dep2`), `AllQuotes` row,
dashboard tiles. Money cells are **read-only in the proposal on purpose** — a typed edit there
never reached `quotes.price` and silently mis-billed. Do not make them editable.

## SPEC TEXT (`specBody`) — SOURCE OF TRUTH: `faCatalog.buildFaSpecLines` → `specSync`
Everything below reads the SAME text. A change to the spec's shape ripples to all of them:
- **Colour chips** (`Proposal.jsx` `syncChips`) parse `<LABEL> COLOR:` lines and glue a chip to
  each. Chips are absolutely positioned in page coords, so ANY layout shift must re-anchor them.
  A chip with no colour line of its own binds to the nearest spec line (`tie`) and holds that
  offset. Automatic re-anchoring must set `histRef.current.silent` or it pollutes undo.
- **Special requirements** — the trailing `•` bullet block of the spec is the rep's special
  requirement; it is lifted into the Special Requirements field.
- **Item description** — derived from sign type + mounting (see below).
- **Placeholders** (`[DEPTH]`, `[ASK REP]`) are scaffolding and must NEVER print on a proposal.
Executable ripple map: adding a line item / typing in the spec must move every chip by the same
delta (verified live, not by reasoning).

### The proposal's SPECIFICATIONS block must FOLLOW the wizard
`EBlock` writes its content ONCE on mount and ignores every later `html` prop (deliberate — React
re-applying the original html would erase what the rep typed). **`setBlock` is therefore the only
honest channel after mount.** The money blocks always used it; the spec text did not, so a spec
rebuilt on the Edit-specs step never reached the preview beside it.

Ownership: a block the rep edited ON the proposal keeps their words (`__dirty`), EXCEPT across a
SIGN TYPE change — that edit described a different product, the same rule the item description and
side view follow.

Detecting "the saved spec is for another type" needs BOTH witnesses OR-ed, because neither is
reliable alone:
- `__specTpl` is a label written at save time and can be saved OUT OF STEP with the text it labels
  (marker took the new type while the write-once DOM still held the old spec).
- the saved text's own `SIGN TYPE:` line only resolves when it spells a catalog name; several
  templates do not (`SIGN TYPE: 1/4" FLAT CUT ACRYLIC LETTERS` vs `Flat Cut Acrylic/PVC Letters`).
Also note `__specTpl` was historically `tpl?.n`, i.e. always null in custom mode — the guard that
depended on it was dead code for every custom quote.

### DEPTH vs THICKNESS — who owns the third dimension
Where the sheet states a `thickness` (the two flat-cut families, `hasThickness`), that value IS the
third dimension: the D box is read-only and shows it verbatim, and `dims.h` is CLEARED so the
template's own `LETTERS THICKNESS:` line stands. A depth left in `dims.h` from a previous type
otherwise wins, because `computeDimSpec`/`syncSpecFromFields` rewrite that line FROM `dims.h`.
- **Never store a thickness in `customSpec.dims`.** Thicknesses are fractions (`1/4"`); `cleanNum`
  keeps only digits and dots and would turn `1/4"` into `14` on a customer's proposal.
- `composeDims` drops empty parts, so omitting D correctly yields `H" x W"`.
- The "depth required" Next gate must exempt these types, or it blocks on a read-only field.
- In these regexes use `[ 	]`, **never `\s`**, after the label's colon: `\s` matches newlines, so on
  an EMPTY `RETURNS:` line the value was written onto the FOLLOWING line (`5" FINISH: SATIN`).

### THE PREVIEW IS READ-ONLY — the wizard is the only way in
Every `EBlock` is `readOnly` (forced in the `E` helper in `Proposal.jsx`, not per call site, so a
block added later cannot reopen the hole by forgetting a flag), and the QTY cell is a `readOnly`
`EditCell`. A typed edit on the preview only ever *looked* like it worked: it changed the printed
page while `quotes.price` / the wizard fields kept the original, so the proposal, the dashboard, a
payment link made afterwards and the next reopen could all disagree. Money cells were locked first
for exactly that reason (#7/#9), then the spec block; the rest followed.
- **Locking does NOT block the programmatic channel.** `contentEditable=false` stops the human,
  not the script: `setBlock` still writes the DOM and still dispatches `input`, which is what
  autosave, per-block `__dirty`, undo history and colour-chip re-anchoring hang off. Verified live.
- Blocks stay VISIBLE and keep their content — read-only, not hidden.
- STILL hand-editable ON PURPOSE, because they have no wizard source and locking them would
  delete the feature: extra line-item / discount rows (`addItem`/`addDiscount` create them in the
  preview), the `AdjDim` measurement-arrow labels, and the colour chips. Locking these means
  first giving them a home in the wizard.

### PASTE INTO PROPOSAL BLOCKS — text yes, files and markup no
(Historical: the paste guards below now sit behind `readOnly`, which returns before them. They are
kept because they are the correct behaviour the moment any block is ever unlocked again.)
`EBlock` sanitizes only the MOUNT write, so anything the browser pastes afterwards lands in the DOM
unsanitized. Blocks therefore take the clipboard's `text/plain` and insert TEXT NODES
(`textOnlyPaste` / `noImagePaste`): fonts, colours, tracked-change spans and embedded `<img>` cannot
exist, whatever was copied. Any FILE payload is refused outright.
- `noImagePaste` alone was NOT enough: it inspected `dataTransfer.files`, but an image copied from
  a web page arrives as `text/html` with an `<img>` tag and went straight through.
- A script-driven contentEditable edit fires **no** `input` event, so the handler dispatches one —
  autosave, per-block `__dirty`, undo history and colour-chip re-anchoring all hang off `input`,
  and without it a paste looks right and is never saved.
- Pasting marks the block dirty, so the live spec re-sync correctly leaves it alone within the same
  sign type.

### Colour chips are DERIVED, so deleting one needs a memory
`syncChips` recreates any missing `auto-*` chip from the spec's colour lines, so a delete without a
record silently reappears. Dismissals live in `__swDismissed` on the proposal state and are checked
before recreating. Seeded `face`/`rettrim` chips are not recreated, so they need no entry.

## ITEM DESCRIPTION — SOURCE OF TRUTH: `MOUNTING_DESC` in `frontend/src/generator/faCatalog.js`
Format: `{SIGN TYPE} WITH {MOUNTING PHRASE} FOR {COMPANY}`, or `{SIGN TYPE} FOR {COMPANY}` when
the mounting adds nothing (Flush Mount). The mounting phrase is the CUSTOMER-FACING wording, not
the catalog's internal key — internal keys carry sizes (`(2.5 mm)`) that do not belong on a
customer document.
Consumers: `CustomSpecsStep.applyFaConfig` (regenerates on mounting change, but NEVER overwrites
a rep's hand-edit), `Proposal.jsx` `itemDesc` block, `AllQuotes` JOB column.

## SIDE VIEW (construction diagram) — SOURCE OF TRUTH: the resolved catalog LEAF
The diagram is a property of the exact leaf — sign type x trim cap x thickness x mounting — so ANY
of those changing must re-derive it. Both change paths (sign type, mounting) share ONE rule,
`sideViewReplaceable()` in `CustomSpecsStep.jsx`.

A CATALOG diagram always belongs to the leaf that was selected when it was assigned, so once the
leaf changes it describes a different product and is replaced. Only non-catalog choices survive:
an uploaded `/storage` or `https:` image, an explicit `__none__`, or several diagrams picked
together.

**Do NOT reintroduce a "does it match the PREVIOUS config?" test.** That was tried and it fails
whenever the stored type and stored diagram drift apart (a quote re-typed in an earlier session):
the app then reads its own stale auto-pick as a deliberate human choice and refuses to update it.

The selected diagram and its canvas geometry have separate ownership. `side_views` follows the
resolved leaf as above; a rep's moved/resized `sv2-*` frame lives in `proposal_state.__layout` and
must be restored on reopen. Package `pkg-*` frames remain derived and are intentionally re-laid out.
On the final preview, side-view changes save directly through `savePart`; quote-level Done must flush
those page handles and must not call `saveProgress`, whose wizard scratch state can be older.
The rule must not depend on knowing the previous selection.

**`customTypeSel` MUST be restored when a part loads** (`resolveSignTypeName`). It is not saved by
the wizard directly — new quotes store `customSpec.signType`, older ones are recovered from the
spec's own `SIGN TYPE:` line by longest-name match. `loadPartIntoHooks` used to blank it on every
load, which hid the mounting/trim-cap dropdowns on every reopened quote and was the reason the
diagram appeared frozen.

## EXPORT (PNG / PDF) — SOURCE OF TRUTH: `Proposal.jsx` `render()` via **html-to-image**
Uses the browser's own layout engine (SVG `foreignObject`), so screen == export by construction.
- Do NOT go back to html2canvas: it re-implements text layout and sank glyphs by up to 9.5px.
- Fonts must be **same-origin** (`/fonts/roboto.css`); a cross-origin font sheet cannot be read
  and the export silently falls back to a wider font, re-wrapping every tight line.

## SHOPIFY PAYMENT LINK — SOURCE OF TRUTH: `ShopifyService::variantsFor` + `PaymentLinkController`
The variant IS the charge, so every field on it is a money field. **MONEY — tests/adversary pass
required before changing anything here.**
- **`requires_shipping` MUST stay `false`.** The variant is a PAYMENT for a sign, not the sign; Epic
  ships outside Shopify and nothing in this codebase reads a shipping address off a Shopify order.
  While it was `true`, Shopify demanded a shipping RATE covering the customer's address and, with no
  zone matching, the checkout dead-ended on "not available for delivery to your location" /
  "Shipping not available" — a correct address, an unpayable link, a $23,000 order (2026-07-30).
  Making it `false` means the failure cannot recur for any address or country, without depending on
  the store's shipping zones. Setting it back re-arms that trap.
- A variant ALREADY in Shopify keeps the flag it was born with: code changes here only affect NEW
  links. Existing ones are repaired with `php artisan payments:fix-shipping` (idempotent, --dry-run).
- Inventory is tracked at exactly 1 (`setInventoryOne`), with `untrackVariant` as the fallback — a
  product whose stock could not be set must stay payable, never read "sold out". **That fallback is
  also a silencer:** it kept every link payable while `setInventoryOne` failed on all of them, so the
  store filled with "Inventory not tracked" products on the wrong warehouse and only a human noticed
  (2026-07-30). Two causes, both now pinned by `tests/Feature/PaymentLinkInventoryTest.php`:
  * the location was `locations.json?limit=1` — "whichever Shopify lists first". This store has
    france / NY / US warehouses. Resolve the US one BY NAME (`usLocationId`), or exactly via
    `SHOPIFY_LOCATION_ID`. Beware the "us" fallback: match it as a WORD — `str_contains` matches
    "france warehoUSe".
  * a new variant has no inventory level at a NON-default location, so `inventory_levels/set` is
    refused until the item is CONNECTED there. Connect, then set (the retry is not optional).
- **KNOWN MONEY RISK, still open: Shopify's cart is shared per browser session.** Links are
  product-page URLs, so opening two of them in one browser leaves BOTH in the cart — observed live
  with three items across two quotes, including a Full Payment and a 50% Deposit for the SAME quote,
  offered as one $23,000 total. One link per session is safe; the accumulation is not detectable
  server-side. Candidate fixes: `/cart/clear?return_to=/products/{handle}`, the theme's "Buy it now"
  dynamic checkout button, or draft-order invoices (needs the `write_draft_orders` scope).
- Read surfaces: `Proposal.jsx` (creates links, `exportBlocked` gate), `PaymentLinks` page,
  `ShopifyWebhookController` (marks paid), `QuoteCheckpoint` (a payment mints a version).

## WIZARD STEP ORDER — SOURCE OF TRUTH: `FLOWS` in `parts.js` + `returnTo` in `Generator.jsx`
Two DIFFERENT things decide where a step goes next, and conflating them has broken this twice:
- **`FLOWS[mode]`** is the pipeline a NEW sign walks: `custom: client → customspecs → artwork →
  preview`. Artwork belongs here — a first-time quote must be asked for it.
- **`returnTo`** is how the step was OPENED. The per-page buttons (`editPart` → "Edit specs",
  `editArtwork` → "Edit artwork") set it to `'preview'`, so Next AND Back both return straight to the
  preview: the rep asked to change one thing, not to re-walk the wizard. `addPage` clears it, because
  a second sign is a new build and needs its own artwork.
**Do NOT express "Edit specs shouldn't pass through artwork" by deleting `artwork` from `FLOWS`.**
That was tried (2026-07-29) and it silently removed the artwork step from the whole custom pipeline —
new quotes were never asked for artwork at all. Entry mode is not a property of the flow.
- `flowIndex === -1` (a step absent from the flow) still falls back to the preview on Back, but it is
  no longer the mechanism — `returnTo` is checked first.
- Consumers: `back()`, `saveNext()`, `toPreview()` (clears the flag), `WizardProgressBar` (segment
  count comes straight from `flow`, so adding a step needs no change there).

## ADDITIONAL NOTES (`notes` block) — SOURCE OF TRUTH: the wizard's TWO note fields
`proposalNotes` (Artwork step) **+ `special_requirements`** (Edit specs, step 5), joined by
`notesHTML` in `Proposal.jsx` and de-duplicated line-wise.
- Special requirements had NO surface on the customer document at all: `splitSpecialRequirements`
  LIFTS the template's trailing bullet out of the spec text into that field, so whatever sat there
  printed nowhere. ADDITIONAL NOTES is that surface — and nothing is duplicated, because the lift
  already removed those lines from SPECIFICATIONS. If the lift is ever removed, this block starts
  double-printing.
- Write-once `EBlock` means the mount write is not enough: a second effect calls
  `setBlock('notes', notesHTML)` on every change (the same channel SPECIFICATIONS uses).
- **Ownership stands here, unlike the spec:** this block is still hand-editable on the sheet, so the
  sync skips it once `notes` is in `__dirty`. A wizard keystroke must never erase words the rep typed
  on the proposal.
- The block only EXISTS while `!specLong && !hideNotes` — a >520-char spec still swallows it (#17),
  and then neither note field shows. Same trade-off as before this feature.
- Read surfaces: `PreviewStep` (quote-level `special`), `LivePreviewPanel`, `ViewProposalImage`.

## CLIENT DOCUMENT sheets — SOURCE OF TRUTH: `blank_pages[].docs` (a list of placed elements)
One blank Letter sheet hangs off EVERY sign page (`ClientDocPage.jsx`, rendered by `PreviewStep`
right under its `Proposal`), so our spec and the customer's own spec sheet are read as a pair.
- Stored through the **extra-file** endpoint, never `quote.customer_pdf`: that column is the quote's
  primary intake drawing and feeds the AI spec read, the artwork fallback and the View carousel. A
  per-page attachment overwriting it would rewrite the quote's own history.
- An element is `{ id, lay, kind }`: `kind:'image'` carries `path` (default when absent — legacy
  rows have no `kind`), `kind:'text'` carries `text`. Images render through `AdjImg`, text through
  `AdjText` (its DUPLICATED-WITH twin). One list, so overlap, selection, removal and export treat
  both kinds identically.
- **ELEMENTS MAY NEVER OVERLAP.** `ClientDocPage.constrainFor(id)` is passed to both components as
  their `constrain` hook and runs on EVERY gesture frame after the bounds clamp: slide on X, else
  slide on Y, else refuse the frame. Enforced during the drag, not repaired after it — a rep must
  see an element stop, not watch it jump on mouse-up. `addBlankText` scans for a free slot for the
  same reason.
- **Text sizes itself to its box.** AdjText binary-searches the largest font that still fits
  (8 halvings, 6–160px) on every box or content change. Content commits on blur, not per keystroke.
- **MANY DOCUMENTS PER SHEET (2026-08).** A blank page holds a LIST. Each entry carries its own
  `lay` — AdjImg geometry in unscaled 816×1056 page pixels — so every document is dragged, resized
  and clamped exactly like the proposal's artwork. All of them share ONE sheet; the job is comparing
  drawings side by side, and that only works on one page.
- **Read `blankDocs(blank)`, never `blank.client_doc`.** `client_doc` was the single-path field this
  replaced; `blankDocs` (usePageCapture.js) is the one place that reads it forward, and the first
  write folds it into the list. Consumers: `PreviewStep` (edit + the remove-page guard),
  `ViewProposalImage` (read-only), `ClientDocPage` (render + capture).
- Geometry is seeded by `ClientDocPage` from the image's natural size, NOT by AdjImg's auto-fit —
  that fit fills the area and centres, which is right for one artwork and would stack every
  document on top of the last.
- Writes go through `setBlankDocLay` / `removeBlankDoc` (Generator.jsx), and BOTH refuse to write a
  list that does not contain the document they were asked to change: a stale list would persist over
  the real one and silently drop the customer's files.
- A PDF is **rasterised** (`rasterizePdfPages`, all pages, max 12). Page 1 joins the free canvas;
  pages 2..n continue as their own centred sheets after it — an `<iframe>` renders on screen
  and exports as an empty box, which would ship blank sheets to a customer. Cloudinary-hosted
  PDF/AI stay one sheet (`cloudRaster` gives page 1 only; the page count is not in the URL).
- Capture handles live in `docRefs` (`usePageCapture`) and return ARRAYS; every collector emits a
  page's doc sheets DIRECTLY AFTER that page, tagged `kind:'doc'` and carrying the SIGN page's
  `index`.
- **`kind` is load-bearing in `runPDF`/`runPNG`:** the file's last sheet is now routinely a customer
  drawing, so the clickable payment-link annotation is placed on the last **sign** sheet via
  `pdf.setPage`, and PNG letters/`multiPages` count sign sheets only. Counting doc sheets moved the
  payment link onto a drawing and, on a single-sign quote, dropped it entirely.
- Any attached doc flips a single-sign quote onto the multi-sheet export path
  (`capturePages = multi || anyClientDoc`), or the download would omit the attachment.

## ADDITIONAL NOTES — SOURCE OF TRUTH: `hideNotes` (the ⊗ / "+ Notes" pair) ONLY
The section is hidden when, and only when, the rep removed it. It is the ONLY place the special
requirement prints, because the lift moves that line OUT of the spec text — so hiding it drops a
build instruction off the customer's document.
- **A section must not be gated by more conditions than it has controls.** It used to be
  `{!specLong && !hideNotes && …}` where `specLong` = spec text over 520 chars, but "+ Notes" only
  cleared `hideNotes`. Over 520 the button was DEAD: the rep clicked, nothing appeared, no reason
  given. Adding a second silent gate to a controlled section is what made this unfindable.
- Measured, not guessed: at 521 chars of spec the sheet had **394px of headroom** — the rule threw
  away ~23 lines' worth of room. Real overflow is caught by the page limit below (content's true
  bottom vs `PAGE_H`) plus `refuseIfFull`; a character count was never needed.
- `specLong` survives, and now only sets the spec block's `minHeight` (185 vs 150).

## PROPOSAL PAGE LIMIT — SOURCE OF TRUTH: `PAGE_H = 1056` in `Proposal.jsx`
Headroom is measured from the **content's real bottom** (lowest in-flow child), NEVER from
`scrollHeight` — the sheet is height-pinned with `overflow:hidden`, so its `scrollHeight`
saturates at 1056 and can measure neither spare room nor overflow.

## PRICE APPROVAL — SOURCE OF TRUTH: `User::canApprovePrices()` (admin + manager)
`price_approved` and `approval_locked` are OVERSIGHT flags: the lock exists so that the person who
set the price is not the person who signs it off. Both are therefore gated server-side in
`QuoteController::update`, and `approved_by`/`approved_at` are stamped from the token, never sent.
- **The gate is on the CHANGE, not on the key being present.** The grid PATCHes the whole quote back
  on every save, so refusing any request that merely *contains* the field would 403 a rep for
  editing a company name. Keep it that way.
- Write surface: `QuoteRow.jsx` only (the two checkboxes). `selectCanApprove` in `authSlice`
  mirrors the server rule so a rep is not shown a control that answers 403 — mirror, not the gate.
- Read surfaces: `Proposal.jsx` `exportBlocked` (blocks PNG/PDF/payment link while locked and
  unapproved), `PaymentLinkController` (same rule server-side), `DashboardController` "Approved"
  tile, `AllQuotes` CSV export, `AirtableQuoteSync` (both directions).
- Changing who may approve = editing `canApprovePrices()` AND `selectCanApprove` in one commit.

## UPLOAD FILENAMES — SOURCE OF TRUTH: `QuoteController::safeExtension()`
`mimes:` proves the BYTES are a pdf/image; it says nothing about the NAME. The stored extension is
therefore taken from the file's own content MIME and checked against `SAFE_EXTENSIONS`, never from
`getClientOriginalExtension()`. `PaymentLinkController::storeImage` applies the same allowlist to
the extension inside the client's `data:image/...` URL. Consumers: everything under `/storage`,
which is served by `bootstrap/app.php` under `CSP: sandbox` (see below) precisely because these
files are attacker-influenced.

## AUTH — SOURCE OF TRUTH: `AuthController` + `authSlice`
Login resolves username first, then case-insensitive email. 2FA turns a correct password into a
short-lived CHALLENGE, never a token. Impersonation is a token *named* `impersonation` — never a
Sanctum ability, because normal tokens carry `*` and `tokenCan()` would match every session.
2FA is mandatory: an unenrolled password login begins purpose-bound setup and creates no session
until a valid TOTP is confirmed. `RequireTwoFactor` rejects old unenrolled bearer tokens on every
protected route; setup start and admin reset revoke existing tokens so they cannot revive later.
The only exception is an audited `impersonation` token, because the administrator already proved
their own second factor and the target user did not perform a login.

## COMPANY AUTOFILL — SOURCE OF TRUTH: `companySuggest` + `AddQuoteModal.onCompanyChange`
Suggestions are ranked exact → starts-with → contains. Alphabetical ordering with a LIMIT hid the
exactly-typed company past row 10 (`Signarama` matches 266 rows), so its address never autofilled.
Name comparison normalises whitespace and edge quotes; real rows contain both.

## QUOTES GRID COLUMNS — SOURCE OF TRUTH: `COLS` in `frontend/src/components/quotes/QuotesTable.jsx`
The header is generated from `COLS`; the body cells are hand-written in `QuoteRow.jsx`. **The two
orders must match exactly** — a column inserted in one and not the other shifts every cell after
it under the wrong heading, silently. Adding a column means editing BOTH files in the same commit.
- Widths are keyed by column NAME (`useColumnWidths`, localStorage `quotes.colwidths.v1`), never
  by index: the column picker hides columns, so an index-keyed map hands one column's width to
  whichever column slides into that slot.
- The table needs `table-layout: fixed` AND an explicit total width (the sum of the visible
  columns). Under `auto` a dragged width is discarded; under `width: max-content` the browser
  inflates the table and spreads the surplus across every column, so narrow widths never stick.
- `react-draggable` (via `react-resizable`) references `process.env.DRAGGABLE_DEBUG`. `process`
  does not exist in the browser, so it throws on every drag start unless vite.config.js `define`s
  that expression. Symptom: dragging does nothing at all, with an empty console.

### Rod / Ed All Quotes privacy
`QuoteController::index` applies `User::restrictsQuoteListingToOwnRepresentative()` before every
optional search, status, assignment, company, source, rush, or date filter. For usernames `rod` and
`ed` this base query is strictly `sales_rep = user.full_name`: filters may narrow it but never widen
it. Do not put this rule into `Quote::visibleTo()` or `isVisibleTo()`; those scopes also protect
direct quote/revision access, where assigned and shared workflows intentionally remain available.

## PAYMENT-LINK PROPOSAL DISPLAY — SOURCE OF TRUTH: `generated_data.payment_link*`
`payment_link` remains the Shopify URL consumed by the proposal CTA and PDF annotation.
`payment_link_kind` (`full`, `deposit`, `balance`) controls the customer-facing totals rows, and
`payment_link_visible` controls only whether the CTA appears in preview/PDF/PNG. An explicit false
hides it; a missing value keeps legacy quotes visible. Hiding must never delete or void the private
`payment_links` ledger row or alter the Shopify product.

Writers: `Generator.savePaymentLink` (URL + kind + visible) and `Generator.hidePaymentLink`
(visibility only). Hydration: `useQuoteData`. Renderers: `Proposal` in the final/live preview and
`ViewProposalImage` in All Quotes. PDF/PNG use the same rendered Proposal DOM, so no export-only
display branch may be introduced. Legacy quotes without a kind retain the prior split-above-$500
layout. Generating a new link always restores visibility.

## QUOTE IDENTITY FIELDS (job, proposal ID, company, client, contact, email, address)
SOURCE OF TRUTH: the **quotes row**. Write surfaces: `QuoteRow.jsx` (grid inline edit) and
`EditQuoteSpecsModal.jsx` (Estimator, "Edit quote specs"). Both PUT `/api/quotes/{quote}`;
`QuoteController::update` is the only validator that counts.
Creator-owned representative defaults are separate from company-history autofill:
`User::defaultSalesRepresentative()` maps usernames `rod`/`ed` (case-insensitive) to that user's
canonical `full_name`; `QuoteController::store` enforces it when intake omits the field, while
`AddQuoteModal` preselects the same value from `user.default_sales_rep`. Other users and existing
quotes retain the prior blank/editable behavior.
Read surfaces:
- `Proposal.jsx` header blocks `infoLeft` (company / client / contact / address) and `infoRight`
  (proposal ID / date / job) — on every page A/B/C of a multi-sign quote.
- `AllQuotes` grid row, dashboard tiles, CSV export, `AirtableQuoteSync`.
- `linkTitle` in `Generator.jsx` — the payment link's product title carries the company name.

**PROPOSAL ID = `quotes.quote_id` = the ROUTE KEY** (`Quote::getRouteKeyName`). Consequences that
have already bitten once each:
- Renaming it changes the page's own URL. The Estimator must `navigate(..., { replace: true })` in
  the same breath, or every later request in that session (autosave, uploads, checkpoints) 404s
  against an ID that no longer exists.
- Anything sequenced AFTER the rename must address the NEW id. The `generated_data` mirror write
  below was ordered after `updateQuote` and 404'd, reporting a failure for a save that had already
  half-landed.
- Uniqueness is a DB constraint AND a server check; the modal only mirrors it. A client-side check
  can never be the gate — two reps can take the same ID between keystroke and save.
- It cannot reach values already MINTED from it: checkpoint labels (`{quote_id}-rev{seq}`) and the
  Shopify payment-link product title keep the old string. The modal names both rather than blocking
  the edit. Child tables are safe — they FK on the numeric `quotes.id`, never on this string.

**JOB NAME EXISTS TWICE AND `generated_data` WINS.** `useQuoteData` hydrates it as
`generatedData.job_name || quote.job_name`, so writing only the quote row looks correct until the
next load — and a Proposal ID rename makes that "next load" immediate, so the new job name vanished
on the spot. Any writer of `job_name` must update BOTH. The other five fields have no second copy.

**COMPANY NAME IS THE QUOTE'S SNAPSHOT, NOT THE COMPANY RECORD.** `quotes.company_name` is copied
at intake; the `companies` row is shared by other quotes. Editing here must never rename the
company for everyone else — only the quote is PUT, `company_id` is left alone.

**THE HEADER IS WRITE-ONCE, SO IT NEEDS `setBlock`.** `initial` in `Proposal.jsx` is memoised on
`[]` — the mount-time snapshot — and `EBlock` ignores every later `html` prop. `infoLeftHTML` /
`infoRightHTML` are therefore hoisted OUT of `initial` and re-applied by an effect, the same shape
SPECIFICATIONS and ADDITIONAL NOTES already use. Without it the fields save correctly and the sheet
standing next to them keeps printing the old values.

NOT reached by this edit (known, deliberate): ITEM DESCRIPTION still reads `... FOR {company}` from
its own saved copy — see the ITEM DESCRIPTION node, which owns that string and its ownership rule.
Executable ripple map: none yet — no e2e suite exists in this repo. Verified live instead: edit →
sheet updates without remount → reload → grid row → duplicate-ID rejection → values restored.
Incident history: shipped inside commit `0db9095`, whose message describes a different feature — a
concurrent session ran `git add -A` mid-edit. The code is this node's; the message is not.

## hidden quotes (per-rep listing preference) — SOURCE OF TRUTH: `quote_hides` (user_id, quote_id)
Written by: `QuoteController::hide` / `::unhide` (POST/DELETE `/api/quotes/{quote}/hide`)
Read by:
- `QuoteController::index` — excluded by default, returned alone under `?hidden=1`
Gate: `User::canHideQuotes()` — role `sales_rep` ONLY. Server-side; the UI selector
  (`selectCanHideQuotes`) only decides whether the control is drawn.
Surfaces:
- `frontend/src/pages/AllQuotes.jsx` — All / Hidden tabs (reps only), `showHidden` -> `?hidden=1`
- `frontend/src/components/quotes/QuoteRow.jsx` — Hide / Unhide button, reps only
Invariants:
- PER USER. One rep hiding a quote must not change any other user's list, and changes NOTHING on
  the quote itself — no status, price, approval or history is touched, so no audit entry exists.
- Roles that see the whole book have no hidden list at all; `?hidden=1` returns [] for them rather
  than falling through to every quote.
- A rep cannot hide a quote they cannot see (`isVisibleTo` is checked on the way in); unhide is not
  gated the same way, or a quote could be stranded in the Hidden tab.
Executable proof: `backend/tests/Feature/AuthzTest.php` — 7 hidden-quote cases
Incident history: requested 2026-08-05 (Rod and Ed park quotes they are not chasing)

## two-factor channel (authenticator vs emailed code) — SOURCE OF TRUTH: `users.two_factor_channel`
Set by: `php artisan users:two-factor-channel <user> <totp|email> [--dry-run]`
Read by:
- `AuthController::login` — mints and emails a code when the channel is `email`
- `AuthController::twoFactorChallenge` — checks the emailed code FIRST, then TOTP, then recovery
- `AuthController::resendTwoFactorCode` — POST /api/two-factor/resend (throttle 3/min)
Code storage: `users.two_factor_email_code` (HASHED), `_expires_at` (10 min), `_attempts` (max 5)
Surfaces: `frontend/src/pages/Login.jsx` (code screen text + "Send another"), `store/authSlice.js`

## payment section on the proposal (CTA + price rows) — SOURCE OF TRUTH: `generated_data.payment_link_visible`
Written by: `Generator.hidePaymentLink` / `Generator.showPaymentLink` (PUT /api/quotes/{id}/generated)
Read by: `Proposal.jsx` — gates BOTH `[data-price-block]` (SUBTOTAL / 50% DEPOSIT / 50% ON SHIPMENT)
  and the CLICK HERE TO MAKE PAYMENT anchor
Controls: "Remove payment & totals" (offered whenever the section is showing, with or without a
  link) and "＋ Restore payment & totals" — the way back, so removal is never one-way
Invariants:
- Presentation only. No Shopify product, payment link or ledger row is created, changed or revoked.
- Hiding takes the PRICE ROWS with the button: a sheet still showing SUBTOTAL and a deposit
  schedule is quoting a price, whatever the CTA says.
- Quotes saved before this flag existed have no key and default to visible.
Incident history: extended 2026-08-05 (send an unconfirmed quote with no pricing shown)

Invariants:
- Default is `totp`; every account not switched over keeps the authenticator flow byte for byte.
- The TOTP secret and recovery codes STAY VALID on an email-channel account. Mail is the one factor
  that fails for reasons the person cannot see (bounce, outage, spam filter) and this is the login
  path — the fallback is what stops a mail problem becoming a lockout.
- The code is never returned by any endpoint, only sent. `sent_to` is masked (r***@domain).
- A channel of `email` on an account with no address falls back to TOTP (`usesEmailTwoFactor`).
DEPENDS ON MAIL BEING CONFIGURED: `mail.default` is `log` by default, which writes the code to
  storage/logs/laravel.log and delivers nothing. Production needs MAIL_* env vars.
Executable proof: `backend/tests/Feature/SecurityTest.php` — 7 email-OTP cases
Incident history: requested 2026-08-05 (Rod does not want an authenticator app)

## automatic quote IDs — SOURCE OF TRUTH: `App\Support\QuoteIdAllocator` (band EC900000–EC999999)
Enabled per user: `users.auto_quote_id` — `php artisan users:auto-quote-id <user> on|off [--dry-run]`
Taken-elsewhere list: `reserved_quote_ids` — `php artisan quotes:import-reserved-ids <csv> [--dry-run]`
Written by: `QuoteController::store` — allocates ONLY when the field is blank AND the account is on
Read by: intake form (`AddQuoteModal` hides the field when `user.auto_quote_id`),
  `quotes/add/quoteSchema.js` (`buildQuoteSchema({autoId})` drops the required rule for them)
Why the band: measured 2026-08-05 across both systems — the house sequence tops out at EC116714 and
  Airtable is STILL CREATING quotes, so a band just above it would be reached in a few thousand
  quotes. 900000 needs ~780,000. Empty in both sets; still six digits, so it reads as a normal ID.
Invariants:
- "Free" means free in BOTH systems. The allocator scans quotes UNION reserved_quote_ids; this
  database holds ~100 IDs and Airtable 3,550, 55 of which already appear in both.
- The unique index on quotes.quote_id is the real guarantee; the scan is an optimisation, and
  `allocate()` retries on a unique violation rather than locking the table.
- No dialect-specific SQL: production runs SQLite, and the first version used MySQL REGEXP.
- A typed ID still wins for an auto account — allocation fills a blank field, it does not seize one.
- Everyone else is untouched: blank ID is still a 422.
KNOWN, NOT ENFORCED: manual entry does NOT refuse an ID that is reserved from Airtable. 55 IDs
  already exist in both systems by design (the estimator was seeded from it), so refusing them would
  break re-creating a legacy quote here. Raise it if the policy should change.
Executable proof: `backend/tests/Feature/QuoteIdAllocationTest.php` — 7 cases
Incident history: requested 2026-08-05 (Rod should not have to invent an unused EC number)
