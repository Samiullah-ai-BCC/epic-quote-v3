import { useMemo, useState } from 'react'
import { buildQuestions } from './questions'

/* Chat-style adaptive Q&A. Calls onComplete(answers) when all questions answered. */
export default function QA({ tpl, ai, initialAnswers = {}, onComplete }) {
  const questions = useMemo(() => buildQuestions(tpl, ai), [tpl, ai])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [history, setHistory] = useState([]) // {q, a}
  const [textVal, setTextVal] = useState('')

  const submit = (q, val) => {
    if (val === '' || val == null) return
    const next = { ...answers, [q.key]: val }
    setAnswers(next)
    setHistory((h) => [...h, { q: q.q, a: String(val) }])
    setTextVal('')
    setIdx(idx + 1)                       // always advance so `done` flips true on the last answer
    if (idx + 1 >= questions.length) onComplete(next)
  }

  const done = idx >= questions.length
  const q = questions[idx]

  return (
    <div className="qa">
      {history.map((h, i) => (
        <div key={i} className="qa-pair">
          <div className="q-bubble">{h.q}</div>
          <div className="a-bubble">{h.a}</div>
        </div>
      ))}

      {!done && q && (
        <div className="qa-active">
          <div className="q-bubble">{q.q}</div>
          {q.type === 'chips' ? (
            <>
              <div className="chip-row">
                {q.options.map((opt) => {
                  const isDef = q.def === opt
                  return (
                    <button
                      key={opt}
                      className={'chip' + (isDef ? (q.aiSet ? ' sel ai' : ' sel') : '')}
                      onClick={() => submit(q, opt)}
                    >
                      {opt}{isDef ? (q.aiSet ? ' ⚡ AI' : ' (default)') : ''}
                    </button>
                  )
                })}
              </div>
              {q.def && (
                <button className="ghost" style={{ marginTop: 12 }} onClick={() => submit(q, q.def)}>
                  {q.aiSet ? 'Accept AI suggestion →' : 'Use default →'}
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                type={q.type === 'number' ? 'number' : 'text'}
                placeholder={q.placeholder || ''}
                value={textVal || (q.def ?? '')}
                style={q.aiSet ? { borderColor: '#7b5ce0' } : undefined}
                onChange={(e) => setTextVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit(q, (textVal || q.def || '').trim())}
                autoFocus
              />
              <button onClick={() => submit(q, (textVal || q.def || '').trim())}>
                {q.aiSet ? 'Accept ⚡' : 'Submit'}
              </button>
            </div>
          )}
        </div>
      )}

      {done && <div className="q-bubble">All specifications captured ✔</div>}
    </div>
  )
}
