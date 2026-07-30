// The CLIENT DOCUMENT sheet that hangs off every sign page.
//
// WHY it exists: the rep has to prove OUR proposal says the same thing as the customer's own spec
// sheet / drawing before it goes out, and that comparison was happening in a separate browser tab
// against a downloaded file. One blank Letter sheet per sign page, holding the customer's file,
// puts both documents in the same scroll — and in the same exported PDF, so the customer receives
// the pair.
//
// It is a PROPOSAL PAGE, not a widget: 816×1056 at the same fit-to-column scale as Proposal.jsx,
// and it exposes the same capture handles (captureSnapshot / captureExport) so usePageCapture can
// treat it as one more page. Those return ARRAYS: a customer PDF is routinely several pages, and
// each one becomes its own sheet.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { fileUrl } from '../../api/client'
import { isCloudDoc, cloudRaster } from '../../generator/artwork'
import { rasterizePdfPages } from '../../generator/pdfRaster'

const PAGE_W = 816
const PAGE_H = 1056
const HD_SCALE = 3   // same capture DPI as Proposal.jsx, so the two page kinds match in the PDF

const ClientDocPage = forwardRef(function ClientDocPage({
  doc, label, busy, onPick, onRemove, readOnly = false, errorText = '',
}, fwdRef) {
  const wrapRef = useRef(null)
  const sheetRefs = useRef([])
  const fileInput = useRef(null)
  const [scale, setScale] = useState(1)
  const [pages, setPages] = useState([])       // rendered image srcs, one per sheet ([] = blank)
  const [loadErr, setLoadErr] = useState('')
  const [rasterizing, setRasterizing] = useState(false)

  // Fit the fixed 816px sheet to the column, exactly as Proposal.jsx does — the two must scale
  // together or the doc sheet would sit at a different size in the same stack.
  useEffect(() => {
    const fit = () => {
      if (!wrapRef.current) return
      const w = wrapRef.current.clientWidth
      // never scale to 0: a container measured while hidden reports 0 and scale(0) collapses it
      if (w > 0) setScale(Math.min(1, w / PAGE_W))
    }
    fit()
    const t = setTimeout(fit, 250)
    window.addEventListener('resize', fit)
    const ro = wrapRef.current ? new ResizeObserver(fit) : null
    if (ro && wrapRef.current) ro.observe(wrapRef.current)
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); ro?.disconnect() }
  }, [])

  const isPdf = useMemo(() => /\.pdf($|\?)/i.test(doc || ''), [doc])

  // Turn whatever was uploaded into image srcs the sheet can show AND html-to-image can capture.
  // A PDF must be rasterised: an <iframe> renders on screen but exports as an empty box, which
  // would silently ship blank pages to the customer.
  useEffect(() => {
    let alive = true
    setLoadErr('')
    if (!doc) { setPages([]); return }
    if (isCloudDoc(doc)) {
      // Cloudinary-hosted PDF/AI: the CDN rasterises page 1 for us. Page count is not knowable
      // from the URL, so these stay one sheet (same limit the wizard's drawing viewer has).
      setPages([cloudRaster(doc, 1600)])
      return
    }
    if (!isPdf) { setPages([fileUrl(doc)]); return }
    setRasterizing(true)
    rasterizePdfPages(fileUrl(doc), 2)
      .then((urls) => {
        if (!alive) return
        if (urls.length) setPages(urls)
        else { setPages([]); setLoadErr('This PDF could not be rendered here — open the file directly to check it.') }
      })
      .finally(() => { if (alive) setRasterizing(false) })
    return () => { alive = false }
  }, [doc, isPdf])

  // One capture per SHEET, in order. Screen-only chrome (.doc-ui) is hidden for the shot, the same
  // way Proposal hides its .adj-ui handles.
  const renderSheet = async (el, pixelRatio) => {
    const chrome = [...el.querySelectorAll('.doc-ui')]
    chrome.forEach((c) => { c.style.visibility = 'hidden' })
    try {
      return await toCanvas(el, {
        pixelRatio, backgroundColor: '#ffffff',
        width: el.offsetWidth, height: el.offsetHeight, cacheBust: true,
      })
    } finally { chrome.forEach((c) => { c.style.visibility = '' }) }
  }
  const captureEach = async (pixelRatio, withDims) => {
    const out = []
    for (const el of sheetRefs.current) {
      if (!el) continue
      const prev = el.style.transform
      el.style.transform = 'none'      // capture at the true 816px size, not the fitted scale
      try {
        const c = await renderSheet(el, pixelRatio)
        out.push(withDims ? { url: c.toDataURL('image/png'), w: c.width, h: c.height } : c.toDataURL('image/png'))
      } catch { /* skip a sheet that fails rather than losing the whole export */ }
      finally { el.style.transform = prev }
    }
    return out
  }
  useImperativeHandle(fwdRef, () => ({
    hasDoc: () => !!doc,
    captureSnapshot: () => captureEach(2, false),
    captureExport: () => captureEach(HD_SCALE, true),
  }))

  // An empty attachment page is still a page: it renders as a blank sheet (that is what was asked
  // for) and carries the dropzone until a file arrives.
  const sheets = pages.length ? pages : [null]
  sheetRefs.current = sheetRefs.current.slice(0, sheets.length)

  const pick = (file) => { if (file && onPick) onPick(file) }

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {sheets.map((src, n) => (
        <div key={n} style={{ height: PAGE_H * scale, overflow: 'hidden' }}>
          <div
            ref={(el) => { sheetRefs.current[n] = el }}
            style={{
              width: PAGE_W, height: PAGE_H, background: '#fff', color: '#111',
              transform: `scale(${scale})`, transformOrigin: 'top left',
              display: 'flex', flexDirection: 'column', position: 'relative',
              fontFamily: 'Roboto, Arial, sans-serif',
            }}
          >
            <div style={{ padding: '18px 40px 8px', fontSize: 11, letterSpacing: 0.6, fontWeight: 700, borderBottom: '1px solid #777', display: 'flex', justifyContent: 'space-between' }}>
              <span>CLIENT DOCUMENT{label ? ` — PAGE ${label}` : ''}</span>
              {sheets.length > 1 && <span>{n + 1} / {sheets.length}</span>}
            </div>
            <div style={{ flex: 1, minHeight: 0, margin: '14px 40px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {src
                ? <img src={src} alt={`Client document page ${n + 1}`}
                    onError={() => setLoadErr('The attached file could not be loaded.')}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : (
                  // screen-only: nothing here prints, so an untouched page exports as a blank sheet
                  <div className="doc-ui" style={{ textAlign: 'center', color: '#8a8a8a', fontSize: 13 }}>
                    {rasterizing ? 'Rendering the document…' : (
                      readOnly ? 'No client document attached.' : <>
                        <div style={{ fontSize: 30, marginBottom: 6 }}>📄</div>
                        <div style={{ fontWeight: 600, color: '#555' }}>Attach the client&rsquo;s document</div>
                        <div style={{ marginTop: 4 }}>PDF or image — their spec sheet or drawing, to check against ours</div>
                        <button className="doc-ui" disabled={busy}
                          onClick={() => fileInput.current?.click()}
                          style={{ marginTop: 12, padding: '7px 14px', borderRadius: 7, border: '1px solid #777', background: '#fff', color: '#111', cursor: 'pointer', fontSize: 13 }}>
                          {busy ? 'Uploading…' : 'Choose file'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              {(loadErr || errorText) && <div className="doc-ui" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', color: '#c0392b', fontSize: 12 }}>{loadErr || errorText}</div>}
            </div>
            {/* screen-only controls, only on the FIRST sheet — one file, one set of actions */}
            {!readOnly && src && n === 0 && (
              <div className="doc-ui" style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
                <button disabled={busy} onClick={() => fileInput.current?.click()}
                  style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #777', background: '#fff', color: '#111', cursor: 'pointer', fontSize: 11 }}>
                  {busy ? 'Uploading…' : 'Replace'}
                </button>
                <button disabled={busy} onClick={onRemove}
                  style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #e05661', background: '#fff', color: '#e05661', cursor: 'pointer', fontSize: 11 }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <input ref={fileInput} type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
})

export default ClientDocPage
