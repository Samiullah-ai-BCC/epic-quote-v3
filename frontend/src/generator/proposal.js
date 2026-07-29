/* Proposal spec-line builder — ports V1 templateSpecLines() / V2 buildSpecBody().
   Generates the Specifications block from a sign-type template + captured answers. */

import { parseDims, composeDims } from './questions'
import { mountingByLabel } from './catalog'
import { buildFaSpecLines } from './faCatalog'

const ILLUM_DEFAULT = '6500K LED MODULES (3 YEAR WARRANTY)'

// MATRIX types: build the normalized block from base fields + the chosen mounting's overlay.
// Uniform by construction — labels, FINISH, and the backer/raceway colour can't drift.
function buildMatrixSpecLines(t, a = {}) {
  const m = mountingByLabel(a.mounting || (t.mountings && t.mountings[0]))
  const L = []
  L.push('SIGN TYPE: ' + (t.desc || t.n) + (m.suffix || ''))
  L.push('FACE: ' + t.face)
  L.push('OVERALL DIMENSIONS: ' + composeDims(parseDims(a.dimensions).l, parseDims(a.dimensions).w, ''))
  L.push('RETURNS: ' + (a.returns || t.retDefault || ''))
  if (t.trim) L.push('TRIM CAP: ' + t.trim)
  L.push('ILLUMINATED: ' + (a.illumination || ILLUM_DEFAULT))
  L.push('MOUNTING: ' + (m.mountLine || t.flushMount))
  if (m.structure) L.push(m.structure)
  L.push('COLOR SPECS:')
  ;(t.baseColors || []).forEach((c, i) => {
    const v = a['color_' + i] || ''
    L.push('  • ' + c.l + ':' + (v ? ' ' + v : ''))
  })
  if (m.extraColor) {
    const v = a.structcolor || ''
    L.push('  • ' + m.extraColor + ':' + (v ? ' ' + v : ''))
  }
  if (a.font) L.push('FONT: ' + a.font)
  L.push('FINISH: SATIN')
  L.push('APPLICATION: ' + (a.application || 'EXTERIOR'))
  return L
}

// Canonical dimensions string for the spec. Standard signs are 2D (H × W — depth lives in
// RETURNS); only monuments keep 3 parts. Also normalizes older saved strings (l_w_h, l*w*h,
// or 3-part strings saved before this rule) so every proposal renders the same clean format.
function specDims(t, a) {
  const p = parseDims(a.dimensions)
  return composeDims(p.l, p.w, t && t.mono ? p.h : '')
}

export function money(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// SPECIFICATIONS prints on a fixed-height sheet, so the spec text has a hard ceiling: at the
// block's 17px line height it holds about 14 lines before the rest would simply be cut off the
// printed page. 14 is also the longest spec in the database today, so nothing existing is
// truncated by this. The wizard stops the rep here rather than letting them find out in a PDF.
export const MAX_SPEC_LINES = 14

// Turn typed spec text into the exact lines the sheet will render.
//
// BLANK LINES ARE PRESERVED. They are the rep's paragraph breaks, and dropping them (the old
// `.filter(Boolean)`) is why the preview never matched what was typed. They cannot be used to push
// content off the page, though: a run of blanks collapses to ONE, and leading/trailing blanks go.
// Semicolons still split, as they always did, so a pasted run-on line still becomes a tidy list.
export function normalizeSpecLines(text) {
  const raw = String(text ?? '')
    .split(/\r?\n/)
    .flatMap((line) => (line.includes(';') ? line.split(/;\s*/) : [line]))
    .map((s) => s.trim())

  const out = []
  for (const line of raw) {
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(line)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

// Returns an array of spec lines for a generator-mode quote.
export function buildSpecLines(t, a = {}, ai = null) {
  if (!t) return []
  if (t.fa) return buildFaSpecLines(t, a)
  if (t.matrix) return buildMatrixSpecLines(t, a)
  // monuments are free-form: render the AI's full spec (or a minimal block) instead of templated lines
  if (t.mono) {
    // custom types: AI's full drawing reading > the team's saved spec template > minimal block
    let body = (ai && ai.fullSpec) ? String(ai.fullSpec) : (t.storedSpec ? String(t.storedSpec) : null)
    if (body && t.customType) {
      // the rep explicitly typed this sign type — it overrides whatever type name the AI read
      body = /^SIGN TYPE\s*:/im.test(body)
        ? body.replace(/^SIGN TYPE\s*:.*$/im, 'SIGN TYPE: ' + t.st)
        : 'SIGN TYPE: ' + t.st + '\n' + body
    }
    body = body ?? [
      'SIGN TYPE: ' + t.st,
      'OVERALL DIMENSIONS: ' + specDims(t, a),
      'ILLUMINATED : ' + (t.illum === 'none' ? 'N/A' : (a.illumination || '6500K LED MODULES (3 YEAR WARRANTY)')),
      'MOUNTING: ' + (a.mounting || t.mountDef || ''),
      'PAINT FINISH: SATIN',
      'COLOR SPECS: ' + (a.colorspecs || ''),
      'APPLICATION: ' + (a.application || 'EXTERIOR'),
    ].join('\n')
    return String(body).split('\n')
  }
  const L = []
  L.push(t.st)
  L.push('FACE: ' + t.face)
  if (t.neon) L.push('NEON COLORS: ' + (a.neoncolors || ''))
  ;(t.extra || []).forEach((x) => L.push(x))
  L.push((t.dimsLabel || 'OVERALL DIMENSIONS') + ': ' + specDims(t, a))
  if (t.ret !== null && t.ret !== undefined) L.push('RETURNS: ' + (a.returns || t.ret))
  if (t.neon) L.push('SHAPE: CUT TO SHAPE')
  L.push((t.illum === 'none' || t.neon ? 'FINISH' : 'PAINT FINISH') + ': SATIN')
  if (t.trim !== null && t.trim !== undefined) L.push('TRIM CAP: ' + (a.trimcap || t.trim))
  if (t.illum === 'led') L.push('ILLUMINATED : ' + (a.illumination || ILLUM_DEFAULT))
  if (t.illum === 'bulb') L.push('ILLUMINATION: ' + (a.illumination || 'BULBS 2" DIAMETER BULBS'))
  if (t.illum === 'faux') L.push('ILLUMINATED : ' + (a.illumination || 'FAUX LED TUBING'))
  if (t.illum === 'neon') L.push('ILLUMINATED : YES')
  if (t.illum === 'none') L.push('ILLUMINATED : N/A')
  L.push('MOUNTING: ' + (a.mounting || t.mount))
  if (t.rb) L.push(t.rb)
  ;(t.extra2 || []).forEach((x) => L.push(x))
  if (t.colors && t.colors.length) {
    L.push('COLOR SPECS:')
    t.colors.forEach((c, i) => {
      // a typed answer always beats the template's fixed value (raceway/backer colors are now askable)
      let v = a['color_' + i] || (c.fixed !== undefined ? c.fixed : '')
      if (v === 'TBD') v = ''   // leave blank rather than print TBD when the color isn't decided
      L.push('  • ' + c.l + ':' + (v ? ' ' + v : ''))
    })
  }
  if (a.font) L.push('FONT: ' + a.font)
  L.push('APPLICATION: ' + (a.application || t.app || 'EXTERIOR'))
  return L
}
