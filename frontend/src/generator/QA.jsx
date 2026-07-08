import { useEffect, useMemo, useState } from 'react'
import { buildQuestions, parseDims, composeDims, cleanNum } from './questions'
import MoneyInput from '../components/MoneyInput'

/* Single, consistent Specifications form. Every sign type shows ONE page of fields
   (the set adapts to the type, but it's always one page — never a variable-length chat).
   Answers are seeded from existing values → AI/template defaults, and synced live to the
   parent so "Next" is always enabled with the current values. */
export default function QA({ tpl, ai, initialAnswers = {}, onComplete }) {
  const questions = useMemo(() => buildQuestions(tpl, ai), [tpl, ai])

  const seed = useMemo(() => {
    const a = {}
    questions.forEach((q) => {
      if (q.type === 'dims') {
        // seed the parts from saved parts, else parse the saved/AI string
        const src = (initialAnswers.dim_l || initialAnswers.dim_w || initialAnswers.dim_h)
          ? { l: initialAnswers.dim_l, w: initialAnswers.dim_w, h: initialAnswers.dim_h }
          : parseDims(initialAnswers.dimensions ?? q.def)
        a.dim_l = src.l || ''
        a.dim_w = src.w || ''
        // 2-part mode (standard signs, H × W): the 3rd number in an AI/old string is the
        // DEPTH — it already lives in the Returns/Thickness answer, so drop it here.
        a.dim_h = (q.parts || 3) === 3 ? (src.h || '') : ''
        a.dimensions = composeDims(a.dim_l, a.dim_w, a.dim_h)
        return
      }
      a[q.key] = initialAnswers[q.key]
        ?? (q.def != null ? String(q.def) : (q.type === 'chips' && q.options?.length ? q.options[0] : ''))
    })
    return a
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions])

  const [answers, setAnswers] = useState(seed)
  const setA = (k, v) => setAnswers((s) => ({ ...s, [k]: v }))
  // update one dimension part and re-derive the canonical L×W×H string in lock-step
  const setDim = (part, v) => setAnswers((s) => {
    const n = { ...s, [part]: cleanNum(v) }   // dimensions are numbers only (#15)
    n.dimensions = composeDims(n.dim_l, n.dim_w, n.dim_h)
    return n
  })

  // keep the parent in sync (seed on mount + every edit) so the wizard always has current answers
  useEffect(() => { onComplete(answers) }, [answers]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="qa-form">
      {questions.map((q) => (
        <div className="field" key={q.key}>
          <label>{q.q}{q.aiSet ? '  ⚡ AI' : ''}</label>
          {q.type === 'dims' ? (
            <div className="dims-row">
              {(q.parts === 2 ? ['dim_l', 'dim_w'] : ['dim_l', 'dim_w', 'dim_h']).map((part, i, arr) => (
                <div className="dims-cell" key={part}>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder={(q.parts === 2 ? ['H', 'W'] : ['L', 'W', 'H'])[i]}
                    value={answers[part] ?? ''}
                    onChange={(e) => setDim(part, e.target.value)}
                  />
                  {i < arr.length - 1 && <span className="dims-x">×</span>}
                </div>
              ))}
              <span className="dims-unit">in</span>
            </div>
          ) : q.type === 'color' ? (
            <ColorField
              options={q.options}
              value={answers[q.key] ?? ''}
              onChange={(v) => setA(q.key, v)}
            />
          ) : q.type === 'chips' ? (
            <div className="chip-row">
              {q.options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  className={'chip' + (answers[q.key] === opt ? ' sel' : '')}
                  onClick={() => setA(q.key, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            q.type === 'number' ? (
              <MoneyInput
                placeholder={q.placeholder || ''}
                value={answers[q.key] ?? ''}
                onChange={(v) => setA(q.key, v)}
              />
            ) : (
              <input
                type="text"
                placeholder={q.placeholder || ''}
                value={answers[q.key] ?? ''}
                onChange={(e) => setA(q.key, e.target.value)}
              />
            )
          )}
        </div>
      ))}
    </div>
  )
}

// A color answer: quick BLACK / WHITE / RGB chips + a real custom colour with an eyedropper
// (browser EyeDropper API) so the rep can capture the sign's ACTUAL face colour right here in
// the wizard (#4), instead of being forced to pick black or white. RGB = colour-changing (#10).
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''))
function ColorField({ options = [], value, onChange }) {
  const custom = isHex(value)
  const pickEyedropper = async () => {
    if (window.EyeDropper) {
      try {
        const { sRGBHex } = await new window.EyeDropper().open()
        if (sRGBHex) onChange(sRGBHex.toUpperCase())
      } catch { /* user pressed Esc — keep the current value */ }
    } else {
      // Safari/Firefox: fall back to the native colour input below
      onChange(isHex(value) ? value : '#1E90FF')
    }
  }
  return (
    <div className="chip-row" style={{ alignItems: 'center' }}>
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          className={'chip' + (value === opt ? ' sel' : '')}
          onClick={() => onChange(opt)}
          style={opt === 'RGB' ? {
            background: value === 'RGB' ? undefined : 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)',
            color: value === 'RGB' ? undefined : '#111', fontWeight: 700,
          } : undefined}
          title={opt === 'RGB' ? 'RGB colour-changing (neon) — shows a colour-wheel swatch on the proposal' : undefined}
        >
          {opt}
        </button>
      ))}
      <button
        type="button"
        className={'chip' + (custom ? ' sel' : '')}
        onClick={pickEyedropper}
        title="Pick the sign's real colour with the eyedropper"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
        {custom ? value : 'Custom'}
      </button>
      {/* native swatch: sets the value directly and doubles as the fallback where EyeDropper is unsupported */}
      <input
        type="color"
        value={isHex(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        title="Or pick from a colour wheel"
        style={{ width: 30, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', background: 'none' }}
      />
    </div>
  )
}
