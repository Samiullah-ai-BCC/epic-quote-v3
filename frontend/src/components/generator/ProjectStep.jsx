// Presentational "Project" wizard step (AI mode): drawing upload + AI reading result.
export default function ProjectStep({ aiLoading, quote, setShowDrawing, onCustomerFile, ai, runAI, aiStatus, goto }) {
  return (
    <div className="step">
      <div className="step-head"><span className="step-icon">🗂️</span><h3>{aiLoading ? 'Reading your upload(s)…' : 'Project'}</h3></div>
      <div className="field">
        {quote?.customer_pdf ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="button" className="ghost sm" onClick={() => setShowDrawing(true)}>📎 View the customer's drawing</button>
            <label className="muted" style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              Replace
              <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={onCustomerFile} />
            </label>
          </div>
        ) : (
          <>
            <label>Customer's drawing (optional)</label>
            <input type="file" accept=".pdf,image/*" onChange={onCustomerFile} />
          </>
        )}
      </div>
      <div className="ai-box">
        {!ai
          ? <button onClick={runAI} disabled={aiLoading}>{aiLoading ? 'Reading…' : '⚡ Read the drawing with AI'}</button>
          : <span><b style={{ color: '#9ae6b4' }}>✔ Specs ready.</b><button className="ghost sm" style={{ marginLeft: 10 }} onClick={runAI} disabled={aiLoading}>{aiLoading ? 'Reading…' : '↻ Re-read'}</button></span>}
        {!ai && <span className="muted" style={{ marginLeft: 10 }}>Or skip and pick the sign type yourself.</span>}
        {aiStatus && <p className="muted" style={{ marginTop: 8 }}>{aiStatus}</p>}
        {ai && (
          <div className="ai-result">
            {/* every field, always — '—' marks what the AI couldn't read (an empty box looked like nothing was retrieved) */}
            {[['Our Client (retail)', ai.companyName], ['End Customer', ai.endCustomer], ['Sign Type', ai.signType], ['Job Name', ai.jobName], ['Dimensions', ai.dimensions],
              ['Returns', ai.returns], ['Trim Cap', ai.trimcap], ['Mounting', ai.mounting], ['Illumination', ai.illumination],
              ['Face Color', ai.faceColor], ['Return Color', ai.returnColor], ['Application', ai.application],
              ['Price', ai.price != null ? '$' + ai.price : null], ['Notes', ai.notes]]
              .map(([k, v]) => (
                <div key={k} className="line">
                  <b>{k}:</b> <span style={v == null || v === '' ? { color: 'var(--text-faint)' } : undefined}>{v == null || v === '' ? '—' : String(v)}</span>
                </div>
              ))}
            {ai.fullSpec && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--gold)', fontSize: 13 }}>Full reading from the drawing</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text-dim)', marginTop: 6 }}>{ai.fullSpec}</pre>
              </details>
            )}
          </div>
        )}
      </div>
      <div className="foot"><span />{/* Back moved to the top-left bar (#4) */}<button onClick={() => goto('signtype')}>Next →</button></div>
    </div>
  )
}
