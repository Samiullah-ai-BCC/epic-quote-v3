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

## PROPOSAL PAGE LIMIT — SOURCE OF TRUTH: `PAGE_H = 1056` in `Proposal.jsx`
Headroom is measured from the **content's real bottom** (lowest in-flow child), NEVER from
`scrollHeight` — the sheet is height-pinned with `overflow:hidden`, so its `scrollHeight`
saturates at 1056 and can measure neither spare room nor overflow.

## AUTH — SOURCE OF TRUTH: `AuthController` + `authSlice`
Login resolves username first, then case-insensitive email. 2FA turns a correct password into a
short-lived CHALLENGE, never a token. Impersonation is a token *named* `impersonation` — never a
Sanctum ability, because normal tokens carry `*` and `tokenCan()` would match every session.

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
