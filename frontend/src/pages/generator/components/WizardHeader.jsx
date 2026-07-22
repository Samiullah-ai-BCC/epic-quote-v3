// Page title + "View drawing" button at the top of the wizard.
export default function WizardHeader({ mode, quoteId, company, customerPdf, onViewDrawing }) {
  return (
    <div className="page-head">
      <div>
        <h1>{mode === 'custom' ? 'Custom Quote Creator' : 'Quote Generator'}</h1>
        <div className="muted">{quoteId} — {company}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {customerPdf && <button className="ghost" onClick={onViewDrawing}>📎 View drawing</button>}
      </div>
    </div>
  )
}
