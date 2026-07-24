import { SIDE_VIEWS } from '../../generator/sideviews'
import { uploadExtraFile } from '../../api/quotes'
import { saveCatalogItem } from '../../api/catalog'

// Floating side-view picker panel (opened from the "+ Choose side views" control). A self-contained
// leaf: it reads/writes the shared side-view selection through props and never reaches into the
// proposal page DOM. Extracted verbatim from Proposal.jsx (structural split only).
//
// The two-level catalog browser (search + main-sign-type groups + card grid) is GONE: side views
// are now auto-picked for the sign type (pickSideView, Generator.jsx) the moment the type is
// chosen, so browsing ~100 cards by hand is dead weight — the only manual action left is "No side
// view" (explicit override) and uploading a one-off custom view.

export default function SideViewPicker({ svAnchor, sideViews, onSideViews, svLib, setSvLib, svSrc, info, flash }) {
  return (
        <div data-sv-picker style={{ position: 'fixed', left: svAnchor.left, top: svAnchor.top, width: 300, zIndex: 150, background: 'var(--navy-700)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {/* explicit no-side-view: clears every pick and removes the section + headline */}
              <label style={{ width: 120, fontSize: 11, textAlign: 'center', cursor: 'pointer', border: sideViews.includes('__none__') ? '2px solid #f5a623' : '1px dashed #999', borderRadius: 6, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 96, color: 'var(--text-dim, #888)' }}>
                <input type="checkbox" checked={sideViews.includes('__none__')}
                  onChange={(e) => onSideViews(e.target.checked ? ['__none__'] : [])} />
                <span style={{ fontSize: 20, lineHeight: 1.4 }}>🚫</span>
                <span>No side view<br />(hides the section)</span>
              </label>
              {/* one-off uploads on this quote that aren't in the library */}
              {sideViews.filter((k) => !SIDE_VIEWS.some((s) => s.key === k) && !svLib.some((it) => it.data?.path === k)).map((k) => (
                <label key={k} style={{ width: 120, fontSize: 10, textAlign: 'center', cursor: 'pointer', border: '2px solid #f5a623', borderRadius: 6, padding: 4 }}>
                  <input type="checkbox" checked onChange={() => onSideViews(sideViews.filter((x) => x !== k))} />
                  <img src={svSrc(k)} alt="uploaded side view" style={{ width: '100%', height: 70, objectFit: 'contain' }} />
                  <div>YOUR UPLOAD</div>
                </label>
              ))}
              <label style={{ width: 120, fontSize: 11, textAlign: 'center', cursor: 'pointer', border: '1px dashed #999', borderRadius: 6, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 96, color: 'var(--text-dim, #888)' }}>
                <input
                  type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f || !info?.quoteId) return
                    e.target.value = ''
                    // No naming prompt (team decision): free-typed names multiplied into a mess of
                    // duplicates. The uploaded FILE's own name is the library name, automatically.
                    const title = (f.name.replace(/\.[^.]+$/, '') || 'SIDE VIEW').toUpperCase()
                    try {
                      const path = await uploadExtraFile(info.quoteId, f)
                      onSideViews([...sideViews.filter((x) => x !== '__none__'), path])
                      try {
                        await saveCatalogItem('side_view', title, { path })
                        setSvLib((l) => [...l.filter((x) => x.name !== title), { id: 'new' + Date.now(), name: title, data: { path } }])
                      } catch { /* library save is best-effort; the quote itself has the view */ }
                      flash(`Side view added (saved as “${title}”).`)
                    } catch { flash('Upload failed — try again.') }
                  }}
                />
                <span style={{ fontSize: 22, lineHeight: 1 }}>⬆</span>
                <span>Upload your own</span>
              </label>
            </div>
        </div>
  )
}
