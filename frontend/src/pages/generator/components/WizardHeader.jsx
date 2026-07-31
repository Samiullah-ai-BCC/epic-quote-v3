// Page title + "View drawing" button at the top of the wizard.
// "Edit quote specs" sits here because this line is already where the quote's identity is shown
// ("EC100001 — Signarama"): the button edits exactly what the rep is reading next to it.
export default function WizardHeader({ mode, quoteId, company, customerPdf, onViewDrawing, onEditSpecs }) {
  return (
    <div className="page-head">
      <div>
        <h1>{mode === 'custom' ? 'Custom Quote Creator' : 'Quote Generator'}</h1>
        <div className="muted">{quoteId} — {company}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {onEditSpecs && <button className="ghost" onClick={onEditSpecs}>✎ Edit quote specs</button>}
        {customerPdf && <button className="ghost" onClick={onViewDrawing}>📎 View drawing</button>}
      </div>
    </div>
  )
}
