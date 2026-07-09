import { useEffect, useState } from 'react'
import { getRevisions } from '../api/quotes'

/* Airtable-style revision history for one quote: every change (field, old -> new) with the user
   and time. Read-only; the backend also stores a full snapshot per version so restore can be
   added later. */
export default function RevisionHistory({ quoteId, onClose }) {
  const [revs, setRevs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    getRevisions(quoteId)
      .then((d) => { if (alive) setRevs(d) })
      .catch((e) => { if (alive) setError(e?.response?.data?.error || 'Could not load history.') })
    return () => { alive = false }
  }, [quoteId])

  const when = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>History — {quoteId}</h2>
          <button className="ghost sm" onClick={onClose}>Close</button>
        </div>

        {error && <p className="err">{error}</p>}
        {!revs && !error && <div className="center" style={{ padding: 30 }}>Loading history…</div>}
        {revs && revs.length === 0 && <div className="muted" style={{ padding: 20 }}>No changes recorded yet.</div>}

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {revs && revs.map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px', background: 'var(--navy-700)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                <b style={{ fontSize: 13 }}>{r.user_name}</b>
                <span className="muted" style={{ fontSize: 12 }}>{when(r.created_at)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {r.changes.map((c, j) => (
                  <div key={j} style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, minWidth: 130, color: 'var(--text-dim)' }}>{c.label}</span>
                    {c.field === '__created'
                      ? <span style={{ color: 'var(--gold)' }}>created</span>
                      : (
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-faint)' }}>{String(c.old ?? '') || '—'}</span>
                          <span style={{ color: 'var(--text-faint)' }}>→</span>
                          <b>{String(c.new ?? '') || '—'}</b>
                        </span>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
