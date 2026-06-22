# Wizard & Intake Flow (Workstream A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both AI-assisted and Custom quote-building modes work cleanly end-to-end, choose the mode once, demand the customer file first, and clear the upload/view/render bugs.

**Architecture:** Mode is selected in the intake modal and passed to the wizard via a `mode` query param + persisted `quote_type`; the wizard renders that flow with no second mode prompt. Uploaded files are served by the existing `/storage/{path}` route. No new dependencies.

**Tech Stack:** Laravel 12 (Sanctum) backend, React 19 + Vite frontend, SQLite (local).

## Global Constraints
- Both **AI** and **Custom** modes are mandatory and must work — never a choice between them.
- Mode is chosen **once** at intake; the wizard never re-asks.
- Uploads accept **PDF + PNG/JPG/JPEG/WebP**.
- AI mode's only forward action is **"Continue to Artwork"** (no "Next").
- The customer PDF/image is requested **first**; users must not retype what the file contains.
- No new heavy dependencies. Commit per task. Never commit `.env`/sqlite/vendor/node_modules.
- Repo: `epic-quote-v3`, push to `origin/main`.
- Frontend has **no test runner** → verification is manual (run dev, click through, observe). Backend has Pest (`./vendor/bin/pest`); use it for the API change.

---

### Task 1: Backend — allow PDF-first creation (company optional)

**Why:** AI mode is PDF-first; the company name comes from the PDF (workstream B), so `store` must not 400 when `company_name` is blank.

**Files:**
- Modify: `backend/app/Http/Controllers/Api/QuoteController.php` (`store`, the `company_name === ''` guard + the company-create block)
- Test: `backend/tests/Feature/QuoteCreateTest.php`

**Interfaces:**
- Produces: `POST /api/quotes` accepts a request with no `company_name` → 201; `company_id` stays null, `company_name` stored as `''`.

- [ ] **Step 1: Write the failing test**
```php
<?php
use App\Models\User;
use function Pest\Laravel\postJson;

it('creates a quote with no company name (PDF-first AI mode)', function () {
    $admin = User::factory()->create(['role' => 'admin', 'full_name' => 'Rod Muffet']);
    $this->actingAs($admin, 'sanctum');

    $res = postJson('/api/quotes', ['sales_rep' => 'Rod Muffet']);

    $res->assertStatus(201);
    expect($res->json('company_name'))->toBe('');
    expect($res->json('quote_id'))->toStartWith('EC');
});
```

- [ ] **Step 2: Run it — expect FAIL** (currently returns 400 "Company Name is required")
```
cd backend && ./vendor/bin/pest --filter="PDF-first"
```
Expected: FAIL (422/400, not 201). If `User::factory` or sanctum guard isn't wired in tests, fall back to the curl check in Step 4.

- [ ] **Step 3: Implement** — in `store`, replace the required-guard so a blank company is allowed and simply skips company auto-creation:
```php
// was: if ($companyName === '') return response()->json(['error' => 'Company Name is required'], 400);
// (remove that guard entirely — company is now optional)
```
And guard the company auto-create so it only runs when a name is present:
```php
$company = null;
if ($companyName !== '') {
    $company = Company::whereRaw('LOWER(name) = ?', [strtolower($companyName)])->first();
    if (!$company) {
        $company = Company::create(['name' => $companyName, 'address' => $address, 'email' => '', 'phone' => '']);
    } elseif ($address && !$company->address) {
        $company->update(['address' => $address]);
    }
}
```
Then in `Quote::create([...])`: `'company_id' => $company?->id,` and `'company_name' => $company->name ?? '',` and the representative block stays inside `if ($company && $clientName !== '')`.

- [ ] **Step 4: Verify**
```
cd backend && ./vendor/bin/pest --filter="PDF-first"     # expect PASS
# fallback if Pest infra missing:
curl -s -X POST http://localhost:8000/api/quotes -H "Authorization: Bearer <token>" -F "sales_rep=Rod Muffet"
# expect HTTP 201 + a quote_id starting EC, company_name ""
```

- [ ] **Step 5: Commit**
```
git add backend/app/Http/Controllers/Api/QuoteController.php backend/tests/Feature/QuoteCreateTest.php
git commit -m "feat(quotes): allow PDF-first creation with no company name"
```

---

### Task 2: Intake modal — AI/Custom chosen once, carried to the wizard

**Files:**
- Modify: `frontend/src/components/AddQuoteModal.jsx`

**Interfaces:**
- Produces: navigates to `/quotes/{quote_id}/generate?mode=ai` or `?mode=custom`. Company is not required in AI mode.

- [ ] **Step 1: Map the two tiles to explicit modes and carry the mode**

In `submit`, replace the AI-only navigation with mode-explicit navigation:
```jsx
const created = await create.mutateAsync(payload)
navigate(`/quotes/${created.quote_id}/generate?mode=${choice === 'ai' ? 'ai' : 'custom'}`)
```
Rename the second tile from "Start from Scratch" to **"Custom"** (keep the ✍️ icon and copy), so the two tiles read **AI Mode** / **Custom**.

- [ ] **Step 2: Make company optional in AI mode**

Change the submit guard so company is only required in Custom mode:
```jsx
if (choice === 'custom' && !form.company_name.trim()) return setError('Company Name is required')
```
(AI mode: company is filled from the PDF later; don't block.)

- [ ] **Step 3: Confirm the file field is first + accepts images** — it already is (`accept=".pdf,image/*"`, label "Customer's PDF/image of the sign required"). No change; just verify in Step 4.

- [ ] **Step 4: Verify (manual)** — `npm run dev`, log in, **+ New Quote**:
  - AI Mode → pick → form shows the file field; create with only a PDF (no company) → lands in the wizard at the project step (no mode picker).
  - Custom → create → lands straight in the custom questions (verified in Task 3).
  - Expected: no "Generator vs Custom" prompt appears for either.

- [ ] **Step 5: Commit**
```
git add frontend/src/components/AddQuoteModal.jsx
git commit -m "feat(intake): choose AI/Custom once, carry mode into wizard, company optional in AI"
```

---

### Task 3: Generator — consume the mode, no re-ask, AI forward = "Continue to Artwork" only

**Files:**
- Modify: `frontend/src/pages/Generator.jsx` (`FLOWS`, the load effect's mode resolution, the mode-picker block, the project-step buttons)

**Interfaces:**
- Consumes: `?mode=ai|custom` from Task 2, and `quote_type` persisted on the quote.

- [ ] **Step 1: Reorder the custom flow to lead with the questions**
```jsx
const FLOWS = {
  generator: ['client', 'project', 'signtype', 'specs', 'artwork', 'preview'],
  custom: ['customspecs', 'artwork', 'preview'],   // straight to questions; client came from intake
}
```

- [ ] **Step 2: Resolve mode from the param and skip the picker** — in the load effect, replace the `aiParam` branch:
```jsx
const modeParam = searchParams.get('mode')               // 'ai' | 'custom' | null
const resolvedMode = g.quote_type || (modeParam === 'custom' ? 'custom' : modeParam === 'ai' ? 'generator' : null)
if (resolvedMode) {
  setMode(resolvedMode)
  if (resolvedMode === 'custom') {
    setStep(g.custom_spec ? 'preview' : 'customspecs')
  } else {
    const hasProgress = g.tpl_name && Object.keys(g.answers || {}).length
    setStep(hasProgress ? 'preview' : 'project')           // AI mode lands on project (PDF + AI)
    if (modeParam === 'ai' && !g.ai) setAutoAi(true)
  }
}
```
(Replace `aiParam`/`setAutoAi` usage accordingly; keep the existing mode-picker JSX as a fallback only for `!mode`.)

- [ ] **Step 3: AI mode — only "Continue to Artwork", no "Next"** — in the `project` step footer, gate the buttons by mode:
```jsx
<div className="foot">
  <button className="ghost" onClick={back}>Back</button>
  {mode === 'generator'
    ? (ai && <button onClick={continueFromAI}>Continue to Artwork →</button>)
    : <button onClick={saveProject}>Next →</button>}
</div>
```
Ensure the in-AI-box "Continue to Artwork Upload →" (continueFromAI) remains the path after extraction. Remove the standalone "Next: Sign Type →" for AI mode.

- [ ] **Step 4: Verify (manual)**
  - Custom: new Custom quote → opens directly on the custom spec questions (item desc, dims, spec text, price) → Artwork → Proposal. No client step, no mode picker.
  - AI: new AI quote with a PDF → project step → "Generate Specs with AI" → after it, the only forward button is **"Continue to Artwork"** → Artwork → Proposal. No "Next".

- [ ] **Step 5: Commit**
```
git add frontend/src/pages/Generator.jsx
git commit -m "feat(wizard): honor chosen mode, custom goes straight to questions, AI forward = Continue to Artwork"
```

---

### Task 4: Confirm uploads accept images (both modes)

**Why:** Audit shows `accept=".pdf,image/*"` everywhere and backend `mimes:pdf,jpg,jpeg,png,gif,webp` — images should already work. This task proves it and fixes only if a real reject surfaces.

**Files:** (verify) `backend/app/Http/Controllers/Api/QuoteController.php` (`store`, `uploadPdf` validation)

- [ ] **Step 1: Manual repro** — `npm run dev` + backend running; create a quote and upload a **.png** as the customer file.
  - Expected: upload succeeds (201), file appears.
  - If it 422s, read the validation message; if `mimes` is the blocker, ensure it reads `mimes:pdf,jpg,jpeg,png,gif,webp` on both `store` and `uploadPdf`.
- [ ] **Step 2: If a fix was needed, commit**
```
git add backend/app/Http/Controllers/Api/QuoteController.php
git commit -m "fix(uploads): accept images alongside PDF"
```
(If no fix needed, note "verified — images already accepted" and skip the commit.)

---

### Task 5: Confirm file serving — "View" opens, images render

**Why:** `/storage/{path}` route was added in `d7751cd`; the blank tab is almost certainly a not-yet-restarted backend. Verify; harden only if needed.

**Files:** (verify) `backend/bootstrap/app.php` (`/storage/{path}` route)

- [ ] **Step 1: Restart backend** (`php artisan serve`) so the route loads, then hit a file URL directly:
```
curl -I http://localhost:8000/storage/pdfs/<some-file>     # expect 200, correct Content-Type
```
- [ ] **Step 2: In the app**, open a quote with an attached **image** → click "View attached file" → file opens in a new tab (not blank); the image renders in the proposal Item Details box.
- [ ] **Step 3:** Confirm a **PDF** customer file shows a working "View PDF" link (it opens), and the proposal box shows the placeholder text (a PDF can't be an `<img>` — auto-preview is workstream B). This is expected, not a bug.
- [ ] **Step 4: Commit only if a code fix was required** (e.g., URL/route correction)
```
git commit -am "fix(storage): serve uploaded files reliably for view + preview"
```

---

## Self-Review
- **Spec coverage:** #1 (Task 2+3), #2 (Task 4), #3 (Task 3), #4 PDF-first (Task 2), #5 view (Task 5), #6 render (Task 5), both-modes-mandatory (Tasks 2+3). All covered.
- **Out of scope (B):** correct-party + sign-type/side-view/attachment extraction, PDF→image rasterization — intentionally not here.
- **Type consistency:** `mode` values are `'ai'|'custom'` (param) → `'generator'|'custom'` (`quote_type`); `FLOWS.custom` first step `'customspecs'` matches the Generator's existing `customspecs` step id.
- **Placeholders:** none — each code step shows the change; bug tasks are verify-then-fix with the concrete fix named.
