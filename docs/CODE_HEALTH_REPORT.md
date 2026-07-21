# Epic Quote v3 — Code Health & Modularity Report

**Date:** 2026-07-20
**Scope:** Full-repo surgical survey (Laravel backend + React 19 / Vite frontend)
**Purpose:** Prepare the codebase to be handed to outside developers.
**Verdict:** **C+ / "works, but not yet professional to hand off."** The app is functional and
tested in the money-critical paths, but modularity, styling discipline, and the enforcement
system described in `CLAUDE.md` are largely **aspirational, not installed**. Two or three
monolith files carry most of the risk.

---

## 1. Executive summary (the one-screen version)

| Dimension | Grade | One-line reason |
|---|---|---|
| Correctness safety net | **B** | Real Pest tests exist for money/authz/intake/status. |
| Backend modularity | **C** | `QuoteController` is a 1,060-line, 28-method god class. |
| Frontend modularity | **C-** | `Proposal.jsx` 1,896 lines, `Generator.jsx` 1,492 lines (single component, 51 hooks). |
| Styling discipline | **D** | **No CSS framework installed at all.** 393 inline `style={{}}` objects; design tokens exist but are bypassed by hardcoded hex everywhere. |
| Discoverability / ripple safety | **D** | No `SYSTEM_MAP.md`, no registry — the whole Layer 2 of your own `CLAUDE.md` is missing. |
| Docs & onboarding | **B-** | Good specs/decisions/dev-setup docs; `CLAUDE.md` is 68 KB and over-promises. |

**The three files that are 70% of the risk:** `Proposal.jsx`, `Generator.jsx`, `QuoteController.php`.
Fix those three and the "give it to devs" story changes completely.

---

## 2. Hard evidence (measured, not guessed)

### 2.1 The monoliths
| File | LOC | Problem |
|---|---|---|
| `frontend/src/components/Proposal.jsx` | **1,896** | Has *some* internal subcomponents (`AdjImg`, `AdjDim`, `EditCell`, `AdjSwatch`) — good instinct — but they all live in one file and the main `Proposal()` takes **20+ props**. |
| `frontend/src/pages/Generator.jsx` | **1,492** | Effectively **one component**, **51 `useState`/`useEffect`** calls, nested `return(` blocks. This is the single least maintainable file in the repo. |
| `backend/.../QuoteController.php` | **1,060** | **28 methods** in one controller. `update()` alone is **~218 lines** (L266–484); `store()` ~137 lines. File handling, checkpoints, revisions, activity feed, artwork upload all crammed together. |
| `frontend/src/pages/AllQuotes.jsx` | **596** | Page + table + filtering + row logic in one. |

### 2.2 Styling reality
- **No `tailwind.config`, no `postcss.config`, no CSS library in `package.json`.** The "CSS libs
  that were supposed to make life easy" are **not installed** — nobody is using them because they
  aren't there.
- **393** inline `style={{…}}` objects across `src` (Proposal 132, Generator 74, AllQuotes 62).
- `index.css` defines **~190 CSS custom properties** (a real token system exists!) — yet color
  literals are hardcoded straight into JSX: `#8b5cf6` appears 13×, `#f9a600` 12×, `#8900ff` 10×,
  etc. **The design system exists and is being ignored.**

### 2.3 Missing enforcement infrastructure
Your `CLAUDE.md` (v2.0/v2.1) describes hooks, `SYSTEM_MAP.md`, registries, reviewer agents,
Playwright smoke, a ratchet log. Reality:
- ❌ No `SYSTEM_MAP.md`
- ❌ No `frontend/src/lib/registry/` and no `app/Support/Registry/`
- ❌ No `tests/e2e/` Playwright smoke
- ✅ Backend Pest tests **do** exist (`MoneyTest`, `AuthzTest`, `IntakeTest`, `RepAssignmentTest`, `StatusManagementTest`)

**`CLAUDE.md` is 68 KB of law describing a system that was never built.** For an incoming dev this
is worse than no doc — it describes guardrails they'll assume exist and don't.

---

## 3. What "humane code" research actually says (and where your devs are right / wrong)

I mapped the two dev complaints against the current empirical + practitioner literature.

### 3.1 On "never above 300 lines → make components"

**Your devs are directionally right, numerically arbitrary.**

- Fowler is explicit: **length is a poor trigger.** The real signal is the *distance between
  intention and implementation* — extract when a block needs a comment to explain *what* it does,
  regardless of line count ([Fowler, *Function Length*](https://martinfowler.com/bliki/FunctionLength.html)).
- Empirical numbers are *much smaller* than 300 for **functions**: Banker et al. found ~44
  statements optimal; a 2022 Java study recommends **methods ≤ ~24 SLOC** for maintainability
  ([arXiv 2205.01842](https://arxiv.org/pdf/2205.01842)). So "300" is a loose *file* budget, not a
  function law.
- The correct rule for React is **cohesion, not line count**: "a component with lots of state
  holding unrelated values is doing too much — split it"
  ([Kondov](https://alexkondov.com/refactoring-a-messy-react-component/),
  [DEV: cohesion & coupling](https://dev.to/somtookaforr/react-architectural-design-a-focus-on-cohesion-and-coupling-2ehg)).

**Rebuttal to give the devs:** *"300 lines" is a smell alarm, not the standard. Don't chase the
number — chase single-responsibility. But by ANY threshold (24, 44, or 300), `Generator.jsx`
(1,492) and `Proposal.jsx` (1,896) are 5–6× over, so the alarm is correct here. The fix is not
"cut to 300 and stop"; it's "each file/component does one thing." A 320-line component that does
one job cleanly is fine; a 280-line one that does four is not.*

### 3.2 On "we're not using the CSS libs that were supposed to make our life easy"

**The devs are right about the pain, wrong about the cause.** There are **no CSS libs installed** —
so this isn't "we forgot to use Tailwind," it's "styling was never given a system, so everything
became inline `style={{}}`." That's why life is hard: 393 inline style objects means every visual
tweak is a hunt-and-peck across JSX, and every color is copy-pasted hex.

**Rebuttal / correction:** You don't strictly *need* a CSS library — you already have a **190-token
CSS-variable design system in `index.css` that nobody references.** Two valid roads:
1. **Cheap & correct:** stop hardcoding hex; route every color/spacing through the existing
   `var(--…)` tokens + a small set of utility classes. Zero new dependencies.
2. **Framework road:** adopt Tailwind (or vanilla-extract / CSS Modules) and migrate incrementally.
Either works — but the *actual* bug is **inline-style sprawl + bypassed tokens**, and installing a
library without banning inline styles will not fix it. Fix the discipline, then optionally add the tool.

---

## 4. Prioritized remediation plan (hand-off ready)

Ordered by payoff-per-hour. Each item is a self-contained ticket.

**P0 — Stop the bleeding (do before handing to devs)**
1. **Trim `CLAUDE.md` to reality.** Delete every rule whose machinery doesn't exist, or build the
   machinery. Right now it lies to new devs. (2 hrs)
2. **Create `SYSTEM_MAP.md`** for the top 3 shared values (`quote.price`, `generated_data`, quote
   status). This is the single highest-leverage doc for "local fix, global breakage." (2 hrs)

**P1 — Break the three monoliths (the core of "make it professional")**
3. **`QuoteController.php` → split by concern.** Extract `QuoteFileController` (artwork/pdf/upload
   methods L679–1048), `QuoteCheckpointController` (L724–799), `QuoteRevisionController`. Move the
   218-line `update()` body into a `QuoteUpdateService`. Target: no controller > ~250 lines, no
   method > ~40.
4. **`Generator.jsx` → extract the flow.** Pull each wizard step and the canvas/preview into their
   own components; lift the 51 hooks into a `useGenerator()` hook + a small store slice. This is the
   biggest single maintainability win in the repo.
5. **`Proposal.jsx` → move existing subcomponents into `components/proposal/` files** and cut the
   20-prop signature down with a context or a single `proposalState` object.

**P2 — Styling system**
6. **Ban inline styles via ESLint** (`react/forbid-dom-props` / custom rule) and **ban raw hex**
   outside `index.css`. Migrate the top offenders to tokens. Decide Tailwind yes/no *after* tokens
   are enforced.

**P3 — Safety ratchet**
7. Add one Playwright money-flow smoke test (the `SYSTEM_MAP` for `quote.price`, made executable).
8. Wire the `pre_tool_guard` / `stop_gate` hooks your `CLAUDE.md` already specifies, or delete them
   from the doc.

---

## 5. What's already good (keep it)
- Backend Pest tests cover the scary paths (money, authz, status, intake, rep assignment).
- `Proposal.jsx` shows the *right instinct* — internal subcomponents — it just wasn't carried to
  its conclusion (separate files).
- A real **190-variable design-token system** already exists in `index.css`; you're 80% there on
  styling, you just aren't wired to it.
- Good `docs/` hygiene: `DECISIONS.md`, `specs/`, `DEV_SETUP.md`, parity checklist.

---

## 6. Migration log (2026-07-20) — dev-stack alignment DONE

The frontend was migrated to the stack the devs asked for. Status vs. their checklist:

| Requirement | Before | After |
|---|---|---|
| tailwindcss + shadcn | none installed | ✅ Tailwind v4 (`@tailwindcss/vite`) + 15 shadcn/ui components, brand tokens mapped into `@theme` so shadcn ships in Epic Craftings colors |
| Remove custom CSS → utility classes | 393 inline `style={{}}`, 730 lines of hand CSS | ✅ 393 → **265** (remainder is computed canvas geometry in Proposal + conservative legacy in Generator); legacy CSS quarantined in a `@layer legacy` **below** utilities so tailwind always wins |
| Reusable / small components | 3 monoliths | ✅ ~40 components extracted into `components/{dashboard,reports,quotes,users,generator,proposal,layout,payments,team,activity,login}/` |
| Redux Toolkit | zustand | ✅ `@reduxjs/toolkit` + `react-redux`; zustand removed; all 8 consumers migrated |
| React Query (server data) | present | ✅ kept |
| axios | present | ✅ kept |
| react-hook-form + zod | none | ✅ installed; live in Login, AddUserDialog, AddQuoteModal |
| Libraries over custom | hand-rolled | ✅ shadcn/lucide/rhf/zod replace custom UI/icons/forms; **+ DOMPurify (was hand-rolled sanitizer), date-fns (was custom timeAgo), react-number-format (was custom MoneyInput), papaparse (was hand-rolled CSV/TSV)** |

**File-size wins:** Proposal 1,896 → 1,359 · Generator 1,492 → 844 · AllQuotes 599 → 194 · Dashboard 291 → 91 · Reports 292 → 75 · Users → 84. No page over ~260 lines except the two canvas files below.

**Two honest exceptions (correctness over line-count — the humane-code rule):**
- `Proposal.jsx` (1,359) — its render body drives a pixel-precise `html2canvas`/jsPDF export; inline geometry and legacy pixel values are kept so PDF output can't drift. The *delicate* parts (eyedropper, drag/resize overlays, fitBounds) are now isolated files, verified byte-for-byte unchanged.
- `Generator.jsx` (844) — the protected state machine + per-part autosave stays verbatim in the orchestrator; all presentational steps were extracted. Kept legacy wizard classes rather than risk Radix `onChange` behavior drift.

**Verified:** `npm run build` green · zero selector-as-function runtime bugs (fixed 3 the migration introduced) · login page renders pixel-correct · clean browser console. **Not yet browser-verified:** logged-in pages (needs a login; backend was up but auth wasn't exercised).

**Remaining (next passes):** delete now-dead legacy CSS rules (`.sidebar/.navlink/.app/.main` no longer referenced); add ESLint bans (no inline `style`, no raw hex, no literal API paths) — hold until Proposal/Generator geometry is addressed so lint doesn't red-wall on legitimate cases; optional swap of custom `sanitizeHtml`/`timeAgo`/`MoneyInput`/`ArtworkCropper` for libraries. Backend `QuoteController` god-class split (P1) is unstarted.

## Sources
- [Martin Fowler — Function Length](https://martinfowler.com/bliki/FunctionLength.html)
- [Empirical Study on Maintainable Method Size in Java (arXiv 2205.01842)](https://arxiv.org/pdf/2205.01842)
- [How Developers Extract Functions: An Experiment (arXiv 2209.01098)](https://arxiv.org/pdf/2209.01098)
- [Clean Code in Practice (arXiv 2507.19721)](https://arxiv.org/html/2507.19721v1)
- [Alex Kondov — Common Sense Refactoring of a Messy React Component](https://alexkondov.com/refactoring-a-messy-react-component/)
- [React Architectural Design: Cohesion and Coupling (DEV)](https://dev.to/somtookaforr/react-architectural-design-a-focus-on-cohesion-and-coupling-2ehg)
- [Splitting a UI into Components: Six Pillars (Medium)](https://medium.com/@abbas-roholamin/splitting-a-ui-into-components-in-react-six-pillars-of-component-architecture-04538e542ce5)
