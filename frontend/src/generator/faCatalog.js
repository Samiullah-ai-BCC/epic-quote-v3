/* FA sign-type catalog — logic layer over the verbatim data in faCatalogData.js.
   Each FA_SIGN_GROUPS entry is a Sign Type; a group's `leaves` are its concrete
   (thickness ×) mounting combinations, each carrying its spec as parsed LINES:
     {t:'text', v}       — fixed line, printed as-is
     {t:'dims', v}       — line has [HEIGHT] + [WIDTH] tokens
     {t:'depth', v}      — line has a [DEPTH] token
     {t:'application', v}— line has an [APPLICATION] token
     {t:'field', label, v} — a "LABEL: [ASK REP]" line — one wizard question per label
   Rendering only ever substitutes the bracketed token in `v` — nothing else about the
   line (wording, labels, punctuation) is touched, so the printed spec is byte-identical
   to the sheet except for the values the rep actually enters. */
import { FA_FAMILY_ORDER, FA_SIGN_GROUPS as RAW_GROUPS } from './faCatalogData'

export { FA_FAMILY_ORDER } from './faCatalogData'

// Every group doubles as a `tpl` object everywhere else in the wizard expects one
// (tpl.n for titles/AI-matching/part-name resolution, tpl.desc for the item description,
// tpl.fa=1 so buildQuestions/buildSpecLines route here). Wrapped once at import time so
// every consumer sees the same stable object per sign type (referential equality matters
// for QA.jsx's `useMemo(() => buildQuestions(tpl, ai), [tpl, ai])`).
export const FA_SIGN_GROUPS = RAW_GROUPS.map((g) => ({ ...g, fa: 1, n: g.signtype, desc: g.signtype }))
export const faGroupByName = (name) => FA_SIGN_GROUPS.find((g) => g.n === name)

// A group's own thickness/mounting OPTIONS, in sheet order (first-seen order in the CSV).
export function faThicknessOptions(group) {
  const seen = []
  group.leaves.forEach((l) => { if (l.thickness && !seen.includes(l.thickness)) seen.push(l.thickness) })
  return seen
}
export function faMountingOptions(group, thickness) {
  const seen = []
  group.leaves.forEach((l) => {
    if (group.hasThickness && l.thickness !== thickness) return
    if (l.mounting && !seen.includes(l.mounting)) seen.push(l.mounting)
  })
  return seen
}

// Resolve the exact leaf for the rep's current thickness/mounting answers. Falls back to the
// group's first leaf so the spec is never blank before the rep has chosen anything.
export function resolveFaLeaf(group, answers = {}) {
  if (!group || !group.leaves?.length) return null
  const thickness = answers.fa_thickness || ''
  const mounting = answers.fa_mounting || ''
  const byThickness = group.hasThickness ? group.leaves.filter((l) => l.thickness === thickness) : group.leaves
  const pool = byThickness.length ? byThickness : group.leaves
  return pool.find((l) => l.mounting === mounting) || pool[0]
}

// Every distinct "LABEL: [ASK REP]" field across ALL of a group's leaves, in first-seen
// order — asked once up front so switching mounting/thickness never loses what was typed.
// Rendering only PRINTS the ones the resolved leaf's own template actually calls for.
function unionFields(group) {
  const seen = []
  group.leaves.forEach((l) => {
    (l.lines || []).forEach((ln) => {
      if (ln.t === 'field' && !seen.includes(ln.label)) seen.push(ln.label)
    })
  })
  return seen
}

const isColorLabel = (label) => /COLOR/i.test(label)
const fieldKey = (label) => 'fa_field_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export function buildFaQuestions(group, ai = {}) {
  ai = ai || {}
  const qs = []
  qs.push({ key: 'dimensions', type: 'dims', q: 'Overall dimensions (H × W)', parts: 2, def: ai.dimensions || null, aiSet: !!ai.dimensions })
  if (group.hasThickness) {
    const opts = faThicknessOptions(group)
    qs.push({ key: 'fa_thickness', q: 'Thickness?', type: 'chips', options: opts, def: opts[0] })
  }
  const mountOpts = faMountingOptions(group, group.hasThickness ? (ai.fa_thickness || faThicknessOptions(group)[0]) : undefined)
  if (mountOpts.length > 1) {
    qs.push({ key: 'fa_mounting', q: 'Mounting?', type: 'chips', options: mountOpts, def: mountOpts[0] })
  }
  // has this group any depth/RETURNS line at all? (flat-cut letters have none — thickness covers it)
  const hasDepth = group.leaves.some((l) => (l.lines || []).some((ln) => ln.t === 'depth'))
  if (hasDepth) qs.push({ key: 'fa_depth', q: 'Returns / depth?', type: 'text', def: ai.returns || '', placeholder: 'e.g. 3"', aiSet: !!ai.returns })
  unionFields(group).forEach((label) => {
    const key = fieldKey(label)
    if (isColorLabel(label)) {
      qs.push({ key, q: 'Color Specs — ' + label + '?', type: 'color', options: ['BLACK', 'WHITE'], def: null })
    } else {
      qs.push({ key, q: label + '?', type: 'text', def: null, placeholder: 'e.g. ' + label.toLowerCase() })
    }
  })
  const hasApplication = group.leaves.some((l) => (l.lines || []).some((ln) => ln.t === 'application'))
  if (hasApplication) qs.push({ key: 'application', q: 'Application?', type: 'chips', options: ['EXTERIOR', 'INTERIOR'], def: (ai.application === 'EXTERIOR' || ai.application === 'INTERIOR') ? ai.application : 'EXTERIOR' })
  qs.push({ key: 'price', q: 'Enter the price (USD)', type: 'number', def: ai.price != null ? String(ai.price) : null, placeholder: 'e.g. 1200', aiSet: ai.price != null })
  return qs
}

// The template's own line already ends in a literal " (e.g. `RETURNS: [DEPTH]"`) — strip any
// inch mark(s) the rep typed into the field so it never doubles up into `5""`.
const stripInches = (v) => String(v ?? '').trim().replace(/["'′″]+$/, '')

export function buildFaSpecLines(group, answers = {}) {
  const leaf = resolveFaLeaf(group, answers)
  if (!leaf) return []
  const dims = (answers.dim_l && answers.dim_w) ? { h: stripInches(answers.dim_l), w: stripInches(answers.dim_w) } : { h: '', w: '' }
  return (leaf.lines || []).map((ln) => {
    if (ln.t === 'dims') return ln.v.replace('[HEIGHT]', dims.h || '[HEIGHT]').replace('[WIDTH]', dims.w || '[WIDTH]')
    if (ln.t === 'depth') return ln.v.replace('[DEPTH]', answers.fa_depth ? stripInches(answers.fa_depth) : '[DEPTH]')
    if (ln.t === 'application') return ln.v.replace('[APPLICATION]', answers.application || '[APPLICATION]')
    if (ln.t === 'field') {
      const v = answers[fieldKey(ln.label)] || ''
      return ln.v.replace('[ASK REP]', v || '[ASK REP]')
    }
    return ln.v
  })
}

// The package + side-view key the RESOLVED leaf carries — Proposal.jsx reads these live
// (package can differ by mounting within one sign type, e.g. neon Flush=C / Ceiling=D).
export function faLeafExtras(group, answers = {}) {
  const leaf = resolveFaLeaf(group, answers)
  return { package: leaf?.package || '', sideview: leaf?.sideview || '' }
}
