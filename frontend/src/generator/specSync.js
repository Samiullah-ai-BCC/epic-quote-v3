// Pure spec-text sync helpers for the manual (custom) mode: keep the free-form
// SPECIFICATION TEXT block in step with the dimension boxes and the application choice,
// so the proposal can never show numbers that differ from the fields (#9/#6).
// Extracted verbatim from Generator.jsx — no React state here; the setCustomSpec wrappers
// stay in the component.
import { parseDims, composeDims, cleanNum } from './questions'

// one dimension box changed → recompose the canonical H×W×D string AND keep the spec text's
// dimensions / returns / thickness lines in sync. The D box also drives the depth in
// RETURNS / LETTERS THICKNESS (#6). Returns the next customSpec object.
export const computeDimSpec = (part, v, cs) => {
  const p = parseDims(cs?.dims)
  p[part] = cleanNum(v)   // dimensions are numbers only (#15)
  const dims = composeDims(p.l, p.w, p.h)
  let specText = cs?.specText || ''
  if (/^(.*DIMENSIONS[^:]*):.*$/im.test(specText)) {
    specText = specText.replace(/^(.*DIMENSIONS[^:]*):.*$/im, `$1: ${dims}`)
  } else if (specText.trim() && dims.trim()) {
    // free-form spec with no dimensions line yet — add one right after SIGN TYPE (or on top)
    specText = /^SIGN TYPE\s*:.*$/im.test(specText)
      ? specText.replace(/^(SIGN TYPE\s*:.*)$/im, `$1\nOVERALL DIMENSIONS: ${dims}`)
      : `OVERALL DIMENSIONS: ${dims}\n` + specText
  }
  // depth (the D box) drives the construction depth lines: keep any suffix text
  // (RETURNS: 3" DEEP ALUMINUM → RETURNS: 5" DEEP ALUMINUM). Synced on EVERY dim edit —
  // not just when D itself changes — so a template default can never linger out of step.
  if (p.h) {
    // [ \t] — NEVER \s — after the colon. `\s` matches newlines, so on an EMPTY "RETURNS:" line
    // the capture group swallowed the line break and the depth was written onto the FOLLOWING
    // line: "RETURNS:" stayed blank and the next line became `5" FINISH: SATIN` on a customer's
    // proposal. Harmless while the line always had a value in it; an empty RETURNS became the
    // normal case once the [DEPTH] placeholder stopped being printed.
    // The optional number is still consumed so a suffix survives (RETURNS: 3" DEEP ALUMINUM ->
    // RETURNS: 5" DEEP ALUMINUM), and `LETTER RETURNS:` is the same line under another name.
    specText = specText
      .replace(/^((?:[A-Z ]*[ \t])?RETURNS?[ \t]*:)[ \t]*(?:[\d./]+["”][ \t]*)?/im, `$1 ${p.h}" `)
      .replace(/^(LETTERS? THICKNESS[ \t]*:[ \t]*).*$/im, `$1${p.h}"`)
      .replace(/[ \t]+$/gm, '')
  }
  return { ...cs, dims, specText }
}

// Picking a sign type prefills its template spec — that template must immediately inherit the
// dims/depth/application ALREADY typed (the "RETURNS: 3 while depth is 1" flaw): the boxes are
// the source of truth, the template only supplies the missing lines.
export const syncSpecFromFields = (specText, cs) => {
  const p = parseDims(cs?.dims)
  const dims = composeDims(p.l, p.w, p.h)
  let s = specText || ''
  if (dims.trim()) {
    s = /^(.*DIMENSIONS[^:]*):.*$/im.test(s)
      ? s.replace(/^(.*DIMENSIONS[^:]*):.*$/im, `$1: ${dims}`)
      : (/^SIGN TYPE\s*:.*$/im.test(s) ? s.replace(/^(SIGN TYPE\s*:.*)$/im, `$1\nOVERALL DIMENSIONS: ${dims}`) : `OVERALL DIMENSIONS: ${dims}\n` + s)
  }
  // Depth owns the WHOLE value of the RETURNS line. The old rule only matched an optional
  // leading number and left the rest of the line standing, so a freshly prefilled FA template
  // (`RETURNS: [DEPTH]"`) came out as `RETURNS: 3" [DEPTH]"` — the depth landed but the
  // placeholder printed next to it on the proposal. `LETTER RETURNS:` is the same line under
  // another name in several FA templates and must be caught by the same rule.
  //
  // [ \t] AFTER THE COLON, NEVER \s — the same trap computeDimSpec above already documents, which
  // this function was left carrying. `\s` matches newlines, so on an empty "RETURNS:" line the
  // capture group swallowed the line break and `.*$` then matched the NEXT line: the depth was
  // written one line down ("RETURNS:" blank, "4"" beneath it — reported from a live quote) and
  // whatever that next line said was REPLACED. A spec that read
  //     RETURNS:
  //     MOUNTING: FLUSH/STUD MOUNT
  // came out as RETURNS: / 4" with the mounting line gone from the customer's proposal.
  // The prefix group has the same problem for names like "LETTER RETURNS:" and is fixed with it.
  if (p.h) {
    // Capture up to the COLON only and supply the separating space here. Capturing the existing
    // spacing instead means a line written "RETURNS:" with nothing after it prints "RETURNS:2"".
    s = s.replace(/^((?:[A-Z ]*[ \t])?RETURNS?[ \t]*:)[ \t]*.*$/im, `$1 ${p.h}"`)
         .replace(/^(LETTERS? THICKNESS[ \t]*:)[ \t]*.*$/im, `$1 ${p.h}"`)
  }

  // REPAIR, not just prevention: quotes saved while the rule above was broken still carry the
  // split in their stored spec text, and they do not fix themselves — the text is only rewritten
  // when someone edits a dimension. Rejoin a value-only line onto the RETURNS line it belongs to.
  // Deliberately narrow: the following line must be nothing but a measurement, so a real spec line
  // can never be pulled up into RETURNS by this.
  s = s.replace(/^([A-Z ]*RETURNS?[ \t]*:)[ \t]*\r?\n[ \t]*\r?\n?[ \t]*([\d./]+[""”][ \t]*)$/gim, '$1 $2')
  // Quotes saved before the placeholders were suppressed still carry the literal tokens in
  // their spec text; they must never survive onto a proposal, filled or not.
  s = s.replace(/\[DEPTH\]["”]?/g, '').replace(/^([A-Z ]*RETURNS?\s*:)[ \t]+$/gim, '$1')
       .replace(/\[ASK REP\]/gi, '').replace(/[ \t]+$/gm, '')

  const app = cs?.application
  if (app) {
    s = /^APPLICATION\s*:.*$/im.test(s) ? s.replace(/^(APPLICATION\s*:\s*).*$/im, `$1${app}`) : s
  }
  return s
}

// the interior/exterior choice must land in the spec's APPLICATION line too (#6).
// Returns the next customSpec object.
export const computeApplicationSpec = (app, cs) => {
  let specText = cs?.specText || ''
  specText = /^APPLICATION\s*:.*$/im.test(specText)
    ? specText.replace(/^(APPLICATION\s*:\s*).*$/im, `$1${app}`)
    : (specText.trim() ? specText.replace(/\s*$/, '') + `\nAPPLICATION: ${app}` : specText)
  return { ...cs, application: app, specText }
}

// The catalog's spec templates end with the job's real-world caveat as a bulleted last line:
//   "*  POWER SUPPLY TO BE INSIDE OF CABINET WITH ON/OFF SWITCH INSTALLED"
// That IS the special requirement, and the rep was retyping it into the Special Requirements
// box by hand. This SPLITS it out: the caller moves it into the field and keeps the remainder
// as the spec text.
//
// The sheet uses BOTH "*" and "•" as its bullet, mixed across sign types (and "•" often carries
// invisible word-joiner padding from the spreadsheet cell). Matching only "•" silently skipped
// the majority of the templates — which is why the cabinet / backboard / raceway notes never
// moved across.
//
// Only the TRAILING run is taken: the colour block in the middle ("  • FACE COLOR: …") is
// bulleted too, but it is followed by FINISH/APPLICATION lines, so walking up from the bottom
// and stopping at the first non-bullet line can never reach it.
const BULLET_LINE = /^\s*[•·▪*]+[\s​⁠ ]*/

export const splitSpecialRequirements = (specText) => {
  const lines = String(specText || '').split('\n')
  let cut = lines.length                       // index where the trailing bullet run begins
  const found = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const raw = lines[i]
    if (!raw.trim()) { if (found.length) break; cut = i; continue }   // skip trailing blanks
    if (!BULLET_LINE.test(raw)) break
    found.unshift(raw.replace(BULLET_LINE, '').trim())
    cut = i
  }
  return {
    special: found.filter(Boolean).join('\n'),
    spec: lines.slice(0, cut).join('\n').replace(/\s+$/, ''),
  }
}

// Merge the lifted requirement into whatever the rep has already written, without ever losing
// their words and without duplicating on a repeat run.
export const mergeSpecial = (current, lifted) => {
  const cur = String(current || '').trim()
  const add = String(lifted || '').trim()
  if (!add) return cur
  if (!cur) return add
  const has = cur.split('\n').some((l) => l.trim().toUpperCase() === add.toUpperCase())
  return has ? cur : cur + '\n' + add
}

// Kept as a thin read-only view for callers that only want the value.
export const extractSpecialRequirements = (specText) => splitSpecialRequirements(specText).special
