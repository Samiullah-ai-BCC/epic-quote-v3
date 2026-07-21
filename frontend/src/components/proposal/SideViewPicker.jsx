import { SIDE_VIEWS } from '../../generator/sideviews'
import { uploadExtraFile } from '../../api/quotes'
import { saveCatalogItem } from '../../api/catalog'

// Floating side-view picker panel (opened from the "+ Choose side views" control). A self-contained
// leaf: it reads/writes the shared side-view selection through props and never reaches into the
// proposal page DOM. Extracted verbatim from Proposal.jsx (structural split only).

// category buckets so ~100 cards read as a catalog, not a wall (T18)
const svGroupOf = (label) => {
  const t = String(label || '').toUpperCase()
  if (/RACEWAY/.test(t)) return 'Channel Letters on Raceway'
  if (/BACKER/.test(t)) return 'Channel Letters on Backer'
  if (/CHANNEL|FRONT LIT|BACK LIT|BACKLIT|HALO|TRIM/.test(t)) return 'Channel Letters'
  if (/MONUMENT/.test(t)) return 'Monuments'
  if (/BLADE|PROJECTING/.test(t)) return 'Blade / Projecting'
  if (/CABINET|LIGHT ?BOX|LIGHTBOX/.test(t)) return 'Cabinets / Lightboxes'
  if (/PYLON|POLE/.test(t)) return 'Pylons'
  if (/NEON/.test(t)) return 'Neon'
  if (/PUSH.?THR/.test(t)) return 'Push-Thru'
  if (/DIMENSIONAL|FLAT CUT|ACRYLIC|METAL LETTER|PVC|FOAM/.test(t)) return 'Dimensional Letters'
  return 'Other'
}
const SV_GROUP_ORDER = ['Channel Letters', 'Channel Letters on Raceway', 'Channel Letters on Backer', 'Dimensional Letters', 'Cabinets / Lightboxes', 'Monuments', 'Blade / Projecting', 'Pylons', 'Push-Thru', 'Neon', 'Other']

export default function SideViewPicker({ svAnchor, svSearch, setSvSearch, sideViews, onSideViews, svLib, setSvLib, svGroup, setSvGroup, svSrc, tpl, info, flash }) {
  return (
        <div data-sv-picker style={{ position: 'fixed', left: svAnchor.left, top: svAnchor.top, width: 620, maxHeight: '72vh', overflowY: 'auto', zIndex: 150, background: 'var(--navy-700)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <input
                placeholder="Search side views… (e.g. raceway, monument)"
                value={svSearch}
                onChange={(e) => setSvSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 340 }}
              />
              {/* explicit no-side-view: clears every pick and removes the section + headline */}
              <label style={{ width: 120, fontSize: 11, textAlign: 'center', cursor: 'pointer', border: sideViews.includes('__none__') ? '2px solid #f5a623' : '1px dashed #999', borderRadius: 6, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 96, color: 'var(--text-dim, #888)' }}>
                <input type="checkbox" checked={sideViews.includes('__none__')}
                  onChange={(e) => onSideViews(e.target.checked ? ['__none__'] : [])} />
                <span style={{ fontSize: 20, lineHeight: 1.4 }}>🚫</span>
                <span>No side view<br />(hides the section)</span>
              </label>
              {/* two-level picker (#3): MAIN sign types first, click one → its side views, with a
                  back button. Searching skips straight to matching cards across all groups. */}
              {(() => {
                const cards = [
                  ...SIDE_VIEWS.map((sv) => ({ key: sv.key, label: sv.label, src: `/side_views/${sv.key}.png` })),
                  ...svLib.filter((it) => it.data?.path).map((it) => ({ key: it.data.path, label: it.name, src: svSrc(it.data.path) })),
                ]
                const groups = new Map()
                cards.forEach((c) => {
                  const g = svGroupOf(c.label)
                  if (!groups.has(g)) groups.set(g, [])
                  groups.get(g).push(c)
                })
                const searching = !!svSearch.trim()
                const CardGrid = ({ list }) => (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {list.map((c) => {
                      const on = sideViews.includes(c.key)
                      return (
                        <label key={c.key} style={{ width: 120, fontSize: 10, textAlign: 'center', cursor: 'pointer', border: on ? '2px solid #f5a623' : '1px solid #ccc', borderRadius: 6, padding: 4 }}>
                          <input type="checkbox" checked={on} onChange={(e) => onSideViews(e.target.checked ? [...sideViews.filter((x) => x !== '__none__'), c.key] : sideViews.filter((x) => x !== c.key))} />
                          <img src={c.src} alt={c.label} style={{ width: '100%', height: 70, objectFit: 'contain' }} />
                          <div>{c.label}</div>
                        </label>
                      )
                    })}
                  </div>
                )
                if (searching) {
                  const hits = cards.filter((c) => String(c.label).toUpperCase().includes(svSearch.trim().toUpperCase()))
                  return hits.length
                    ? <div style={{ width: '100%' }}><CardGrid list={hits} /></div>
                    : <div className="muted" style={{ fontSize: 12, width: '100%' }}>No side views match “{svSearch}”.</div>
                }
                if (!svGroup || !groups.has(svGroup)) {
                  return (
                    <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {SV_GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
                        <button key={g} type="button" className="ghost" onClick={() => setSvGroup(g)}
                          style={{ minWidth: 180, textAlign: 'left' }}>
                          <b>{g}</b> <span className="muted">· {groups.get(g).length} →</span>
                        </button>
                      ))}
                    </div>
                  )
                }
                return (
                  <div style={{ width: '100%' }}>
                    <button type="button" className="ghost sm" style={{ marginBottom: 8 }} onClick={() => setSvGroup(null)}>← Main sign types</button>
                    <div style={{ fontSize: 12, fontWeight: 700, margin: '2px 0 6px', color: 'var(--text-dim, #777)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{svGroup} ({groups.get(svGroup).length})</div>
                    <CardGrid list={groups.get(svGroup)} />
                  </div>
                )
              })()}
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
                    // name it (e.g. the sign type) so it's findable on every future quote
                    const suggested = (tpl?.n || f.name.replace(/\.[^.]+$/, '')).toUpperCase()
                    const title = (window.prompt('Name this side view so the whole team can reuse it:', suggested) || '').trim()
                    try {
                      const path = await uploadExtraFile(info.quoteId, f)
                      onSideViews([...sideViews.filter((x) => x !== '__none__'), path])
                      if (title) {
                        await saveCatalogItem('side_view', title, { path })
                        setSvLib((l) => [...l.filter((x) => x.name !== title.toUpperCase()), { id: 'new' + Date.now(), name: title.toUpperCase(), data: { path } }])
                        flash(`Saved to the library as “${title.toUpperCase()}”.`)
                      } else {
                        flash('Side view added to this quote only (no name given).')
                      }
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
