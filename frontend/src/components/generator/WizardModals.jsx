// Presentational overlays for the Generator: the leave-quote prompt and the customer-drawing
// viewer. Extracted verbatim from Generator.jsx; all state stays in the page.
import { fileUrl } from '../../api/client'
import { deleteQuote } from '../../api/quotes'
import { isCloudDoc, cloudRaster } from '../../generator/artwork'

// Back on the proposal asks what to do with the quote (#3): keep it or delete it entirely
export function ExitAskModal({ admin, saving, saveAndReturn, quoteId, qc, navigate, onClose }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 420 }}>
        <h2 style={{ marginTop: 0 }}>Leave this quote?</h2>
        <p className="muted" style={{ fontSize: 13.5 }}>Save it (everything is kept, you can come back any time){admin ? ', or delete the quote entirely — this cannot be undone' : ''}.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button disabled={saving} onClick={async () => { onClose(); await saveAndReturn() }}>💾 Save &amp; leave</button>
          {admin && (
            <button className="ghost" style={{ color: '#e5484d', borderColor: '#e5484d' }} disabled={saving}
              onClick={async () => {
                try { await deleteQuote(quoteId); qc.invalidateQueries({ queryKey: ['quotes'] }); navigate('/quotes') }
                catch (e) { alert(e?.response?.data?.error || 'Could not delete the quote.') }
              }}>🗑 Delete quote</button>
          )}
          <button className="ghost" onClick={() => onClose()}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// In-app viewer for the customer's uploaded drawing (image / PDF / Cloudinary-rasterized).
export function DrawingModal({ quote, drawingOk, onClose }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(900px, 96%)', height: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b>Customer's drawing</b>
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="ghost sm" href={fileUrl(quote.customer_pdf)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open in new tab</a>
            <button className="ghost sm" onClick={() => onClose()}>Close</button>
          </div>
        </div>
        {drawingOk === null ? (
          <div className="center" style={{ flex: 1, color: 'var(--text-dim)' }}>Loading…</div>
        ) : drawingOk === false ? (
          <div className="center" style={{ flex: 1, flexDirection: 'column', gap: 6, color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 15, color: 'var(--text)' }}>This drawing isn't on the server.</div>
            <div style={{ fontSize: 13 }}>It looks like an older upload from before files were stored permanently. Re-upload it with "Replace" on the project step.</div>
          </div>
        ) : isCloudDoc(quote.customer_pdf)
          ? <img src={cloudRaster(quote.customer_pdf)} alt="Customer drawing" style={{ flex: 1, objectFit: 'contain', minHeight: 0, background: '#fff', borderRadius: 8 }} />
          : /\.pdf$/i.test(quote.customer_pdf)
            ? <iframe title="Customer drawing" src={fileUrl(quote.customer_pdf)} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, background: '#fff', minHeight: 0 }} />
            : <img src={fileUrl(quote.customer_pdf)} alt="Customer drawing" style={{ flex: 1, objectFit: 'contain', minHeight: 0 }} />}
      </div>
    </div>
  )
}
