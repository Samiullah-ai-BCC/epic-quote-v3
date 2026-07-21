// Presentational "Specifications" wizard step (AI mode). Wraps the QA questionnaire and
// the Next-button gate. The validation below is pure derivation from props — no state.
import QA from '../../generator/QA'
import { MAX_PRICE } from '../../generator/parts'

export default function SpecsStep({ tpl, ai, answers, finishSpecs, next }) {
  // dimensions are mandatory (#3): require H + W actually filled (read the raw fields so a
  // collapsed composed string can't sneak through). For 3D (mono) types that show a D box,
  // depth is required too; standard 2D signs carry their depth in the Returns field — which
  // is ALSO mandatory whenever the type asks it (matters for signage: wrong/blank depth is
  // a real fabrication error, not cosmetic).
  const hasReturnsQ = tpl?.matrix || (tpl && tpl.ret !== null && tpl.ret !== undefined)
  const noDims = !String(answers.dim_l ?? '').trim() || !String(answers.dim_w ?? '').trim()
    || (tpl?.mono && !String(answers.dim_h ?? '').trim())
    || (hasReturnsQ && !String(answers.returns ?? '').trim())
  const priceNum = Number(answers.price)
  const overMax = Number.isFinite(priceNum) && priceNum > MAX_PRICE
  const badPrice = String(answers.price ?? '').trim() === '' || !Number.isFinite(priceNum) || priceNum <= 0 || overMax
  const hint = noDims ? 'Enter the dimensions and depth to continue' : overMax ? `Maximum quote price is $${MAX_PRICE.toLocaleString()}` : badPrice ? 'Enter a real price (more than $0) to continue' : ''
  return (
    <div className="step">
      <div className="step-head"><span className="step-icon">📐</span><h3>Specifications — {tpl.n}</h3></div>
      <QA tpl={tpl} ai={ai} initialAnswers={answers} onComplete={finishSpecs} />
      <div className="foot">
        <span />{/* Back moved to the top-left bar (#4) */}
        {hint && <span style={{ color: 'var(--text-faint)', fontSize: 12, alignSelf: 'center' }}>{hint}</span>}
        <button disabled={!Object.keys(answers).length || noDims || badPrice} onClick={() => next()}>Next: Upload Artwork →</button>
      </div>
    </div>
  )
}
