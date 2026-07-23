// Sign-part model helpers for the Generator — pure functions / constants, no React state.
// Moved out of Generator.jsx verbatim (structural extraction only).
import { T } from './catalog'
import { FA_SIGN_GROUPS } from './faCatalog'

// AI matching + saved-part resolution both need to find a sign type wherever it now lives —
// the legacy pre-combined T[] entries (many superseded but still resolvable) AND the FA
// sign-type groups (family/mounting-driven, faCatalogData.js). FA MUST come first: several
// FA sign types share their exact name with the legacy entry they supersede (e.g. "HALO LIT
// CHANNEL LETTERS", "MARQUEE CHANNEL LETTERS") — T[] keeps that legacy entry (marked
// legacy:1, hidden from the picker) only so an OLD saved quote can still resolve it, but a
// name-based lookup must find the current FA definition first, or every match silently
// falls back to the superseded one even though the rep picked the current one.
const CATALOG_POOL = () => [...FA_SIGN_GROUPS, ...T]

export const MAX_PRICE = 1000000   // sanity guard against typos — real jobs go into 6 digits (also clamped server-side)

export const FLOWS = {
  generator: ['client', 'project', 'signtype', 'specs', 'artwork', 'preview'],
  // manual mode gets the Artwork step too, so the sign image can be added/changed here
  // (the proposal even points to it) — it was missing before.
  custom: ['client', 'customspecs', 'artwork', 'preview'],
}

// A sign type the catalog doesn't have: free-form template (like monuments) — the spec body
// comes from the AI's full reading of the drawing when available, and the wizard asks the
// generic questions (dimensions, illumination, mounting, colors, application, price).
export const makeCustomTpl = (name, storedSpec = null) => {
  const N = name.trim().toUpperCase()
  return { n: N, st: N, mono: true, illum: 'led', mountDef: '', desc: N, customType: true, storedSpec }
}

// The fields that make up ONE sign part. Company/client/job/payment_link live at the top level
// of generated_data (shared across every part) — only these are per-part.
export const PART_KEYS = ['quote_type', 'tpl_name', 'tpl_stored_spec', 'custom_spec', 'answers', 'ai',
  'artwork_path', 'artwork_auto', 'sign_box', 'side_views', 'proposal_notes', 'proposal_state']

// A→Z→AA labels for the parts (rarely past B in practice, but never breaks).
export const partLetter = (i) => {
  let s = ''
  do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1 } while (i >= 0)
  return s
}

// Lazy-wrap a legacy single-sign generated_data (fields at top level) into one part object,
// so old quotes and new quotes share exactly one shape from load onward.
export const legacyPartFromGd = (g) => {
  const p = {}
  for (const k of PART_KEYS) if (g[k] !== undefined) p[k] = g[k]
  return p
}

// Robust AI signType → catalog match: exact → normalized → contains → best token overlap.
// The model often returns a near-name (e.g. "1\" DEEP RAISED ALUMINUM LETTERS") that isn't
// verbatim in the catalog; this still snaps it to the closest real sign type.
export function matchSignType(name) {
  if (!name) return null
  const pool = CATALOG_POOL()
  const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const target = norm(name)
  let m = pool.find((t) => t.n === name) || pool.find((t) => norm(t.n) === target)
  if (m) return m
  m = pool.find((t) => norm(t.n).includes(target)) || pool.find((t) => target.includes(norm(t.n)))
  if (m) return m
  const words = new Set(target.split(' ').filter((w) => w.length > 2))
  let best = null, bestScore = 0
  for (const t of pool) {
    const score = norm(t.n).split(' ').filter((w) => w.length > 2).reduce((n, w) => n + (words.has(w) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = t }
  }
  return bestScore >= 2 ? best : null
}

// Resolve a saved part's tpl_name against BOTH catalogs; fall back to a free-typed custom
// template (never null) so an old/unknown name still opens instead of crashing the wizard.
export function resolveTplByName(name, storedSpec = null) {
  if (!name) return null
  return CATALOG_POOL().find((t) => t.n === name) || makeCustomTpl(name, storedSpec)
}

// One extra proposal_state.__items row's dollar amount — shared by Proposal.jsx (live total)
// and Generator.jsx (part/grand total) so they can NEVER drift from each other or from the
// backend's own copy (QuoteController::partTotal, same shape, kept in lockstep by hand).
// A row has an explicit `amount` now (line items and discounts are Description + Amount only,
// qty/unit price dropped — #6); `kind: 'discount'` SUBTRACTS instead of adding. Old rows saved
// before this change have no `amount`/`kind` — fall back to their original qty × unit so nothing
// on an existing quote silently changes price.
export function itemSigned(it) {
  const amt = (it && it.amount != null && it.amount !== '')
    ? Math.max(0, Number(it.amount) || 0)
    : Math.max(0, Number(it?.qty) || 0) * Math.max(0, Number(it?.unit) || 0)
  return it?.kind === 'discount' ? -amt : amt
}
