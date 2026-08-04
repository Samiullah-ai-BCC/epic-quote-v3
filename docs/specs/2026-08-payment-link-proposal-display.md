# SPEC: Payment-link proposal display
Status: APPROVED        Owner: Epic Craftings        Issue: in-chat request (2026-08-04)

## 1. Intent
The customer-facing quote must explain the amount represented by its current Shopify payment link.
Staff must also be able to send a clean proposal without displaying that link, while preserving the
actual Shopify link and its private ledger history for later use.

## 2. Behavior contract
- GIVEN a full-payment link WHEN the proposal is previewed or exported THEN the totals area shows
  only `SUBTOTAL` with the full quote amount.
- GIVEN a 50% deposit link WHEN the proposal is previewed or exported THEN the current three rows
  remain: subtotal, 50% deposit due now, and 50% due on shipment.
- GIVEN a remaining-balance link WHEN the proposal is previewed or exported THEN the totals area
  shows only `50% REMAINING` with half the quote amount.
- GIVEN an existing quote without a saved payment kind WHEN it is opened THEN its current totals
  layout remains unchanged.
- GIVEN a visible payment link WHEN staff chooses `Remove from Quote` and confirms THEN the CTA is
  hidden from preview, PDF, and PNG after refresh, without deleting, voiding, or modifying the
  Shopify product or payment-link ledger record.
- GIVEN a hidden link WHEN a new payment link is generated THEN the new link becomes visible and its
  selected payment kind controls the totals layout.
- GIVEN a save failure WHEN a link is created or hidden THEN the UI reports the failure and must not
  silently claim a persisted state that the quote did not save.

## 3. Vertical slice checklist
- [x] UI: kind-aware totals plus a confirmed `Remove from Quote` control
- [x] Endpoint: existing payment-link creation and generated-data update endpoints only
- [x] Persistence: backward-compatible `payment_link_kind` and `payment_link_visible` keys inside
  `quotes.generated_data`; existing `payment_link` URL remains unchanged
- [x] Validation: only `full`, `deposit`, and `balance` affect totals; unknown/missing kinds use the
  legacy layout
- [x] Error state: generated-data persistence failures are surfaced to the user
- [x] Empty/legacy state: quotes without a URL or metadata keep existing behavior

## 4. Impact map
- State owner: `frontend/src/pages/Generator.jsx`
- Hydration: `frontend/src/pages/generator/hooks/useQuoteData.js`
- Interactive preview: `frontend/src/components/generator/PreviewStep.jsx`
- Live preview: `frontend/src/pages/generator/components/LivePreviewPanel.jsx`
- Read-only proposal: `frontend/src/components/quotes/ViewProposalImage.jsx`
- Rendering and PDF/PNG capture: `frontend/src/components/Proposal.jsx`
- Existing backend creation/ledger: `PaymentLinkController`, `PaymentLink`, and `ShopifyService`
  remain unchanged
- Executable proof: focused frontend tests where available plus production build and source-level
  consumer checks

## 5. Money and audit decisions
- The backend remains the authority for the amount charged by Shopify; display metadata never
  changes the product amount.
- Removing a link from the proposal is presentation-only. It must not erase audit history or make a
  live Shopify link appear revoked.
- The existing URL key is retained for every current consumer and export annotation. New metadata
  is additive, preventing old quotes and integrations from breaking.
