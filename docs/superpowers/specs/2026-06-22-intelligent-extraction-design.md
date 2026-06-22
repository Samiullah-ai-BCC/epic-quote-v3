# Workstream B — Intelligent Extraction (sign type + side view + attachment)

Date: 2026-06-22
Status: design approved; pending spec review
Repo: epic-quote-v3

## Goal
The AI reads the customer's PDF/image and auto-identifies the correct **party**, **sign type**,
**side view**, and **attachment**, filling the quote so the rep barely types. Also restores the
monument catalog and the side-view library that the original tool (and V2/`epic-estimator`) had
but v3 dropped.

## Engine (locked)
Groq only. `llama-3.3-70b-versatile` for text (party + specs); `meta-llama/llama-4-scout-17b-16e-instruct`
vision for the drawing → side-view match. No Claude, no CLIP/embedding service. (Party extraction —
`companyName` = retail client, `endCustomer` — already shipped in commit `efaa9ca`.)

## Requirements
1. **Restore 10 monument/cabinet types** + a **free-form monument spec body** (AI `fullSpec`), not templated lines.
2. **Restore the side-view picker** in the proposal + the construction-image **library**.
3. **Curated sign-type → side-view map** (deterministic prior).
4. **Hybrid side-view detection:** map prior + Groq `llama-4-scout` vision refine → **fuse** → agree =
   auto-select; disagree/low-confidence = ranked candidates the rep confirms in one click. Never silently wrong.
5. **Attachment** (mounting + raceway/backer — already extracted) surfaced and applied to the spec + side view.
6. **Persist** chosen side-view(s) + attachment in `generated_data`; render on the proposal.

## Design

### Components
- **Catalog (`frontend/src/generator/catalog.js`):** append the 10 `mono:1` monument/cabinet entries
  (lift verbatim from `epic-estimator/client/src/pages/QuoteGeneratorPage.jsx`). `frontend/src/generator/proposal.js`
  gains a `mono` branch: if `tpl.mono`, render the free-form spec body from `ai.fullSpec` (fallback to a
  minimal monument block) instead of `buildSpecLines`.
- **Side-view library:** copy the construction PNGs from `Side View/` into `backend/storage/app/public/side_views/`
  (served by the existing `/storage/{path}` route; listed by `/api/side-views`). Re-add a side-view picker
  to the proposal (port the V2 `ProposalEditor` side-view picker, simplified) writing selections into `proposal_state.side_views`.
- **Map (`frontend/src/generator/sideviews.js`, new):** `SIGN_TO_SIDEVIEW` table mapping each catalog sign-type
  name → one or more side-view keys. Single source of truth for the deterministic prior.
- **Detection:** extend `AiController::generateSpecs` — when a drawing image is present, the `llama-4-scout`
  call also returns `sideViewKey` (chosen from the provided library key list) + `sideViewConfidence`.
  Frontend fuses: `mapCandidates = SIGN_TO_SIDEVIEW[tpl.n]`; if vision key ∈ candidates or confidence high →
  auto-select; else present `[...mapCandidates, visionKey]` ranked for the rep to confirm.
- **Attachment:** derive from `answers.mounting` + the template's raceway/backer (`tpl.rb`); show in the proposal
  and as part of the side-view caption.

### Data flow
PDF/image → Groq text (party + specs + `fullSpec`) + Groq vision (`sideViewKey`) → frontend maps sign type →
side-view candidates → fuse with vision → auto-select or rep-confirm → persist to `generated_data` → proposal renders.

## Out of scope
- **Multi-line items** — its own spec immediately after B (`quote_items` 1→N + proposal table + totals).
- True CV/CLIP embeddings; Claude vision (Groq chosen).

## Data sources (reuse, don't recreate)
- Monument catalog entries: `epic-estimator/client/src/pages/QuoteGeneratorPage.jsx`.
- Side-view PNGs: `Side View/` and `epic-quote-tool/uploads/side_views/`.

## Acceptance criteria
- A monument type is selectable; its free-form spec renders on the proposal.
- The side-view picker is back; the library is populated and shows thumbnails.
- AI extract on a clear channel-letter drawing → the correct side view is auto-selected (map + vision agree);
  on an ambiguous drawing → ranked candidates appear and the rep picks one.
- Attachment (mounting + raceway/backer) is shown and lands on the proposal.
- Everything runs on Groq; no new external services.
