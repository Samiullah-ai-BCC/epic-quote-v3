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
//
// MANY DOCUMENTS, ONE SHEET (2026-08): the page used to hold exactly one file, centered and fixed.
// It now holds a LIST, each item freely placed and resized with the same AdjImg the proposal uses
// for artwork — because the job is comparing several of the customer's drawings against ours, and
// that comparison happens on ONE sheet or it isn't a comparison. Multi-page PDFs still expand: the
// first page joins the free canvas, pages 2..n continue on their own sheets after it, centered as
// they always were. Losing a page of the customer's own file is not an acceptable trade for
// tidier code.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { toCanvas } from 'html-to-image'
import { fileUrl } from '../../api/client'
import { isCloudDoc, cloudRaster } from '../../generator/artwork'
import { rasterizePdfPages } from '../../generator/pdfRaster'
import { ORG_ADDRESS_HTML } from '../proposal/util'
import AdjImg from '../proposal/AdjImg'

const PAGE_W = 816
const PAGE_H = 1056
const HD_SCALE = 3   // same capture DPI as Proposal.jsx, so the two page kinds match in the PDF

// The free canvas: everything below the letterhead band, inside the sheet's margins. AdjImg clamps
// every drag and resize to this box, so an image can never be dragged off the paper (the fitBounds
// rule the artwork box has always had — "an image may never leave its box").
const CANVAS_W = 736     // 816 − 40 left − 40 right
const CANVAS_H = 932     // 1056 − 70 letterhead − 14 top − 40 bottom

// Where the nth image lands before anyone touches it: a two-column stagger, aspect preserved.
//
// WHY WE COMPUTE THIS INSTEAD OF LETTING AdjImg AUTO-FIT: AdjImg's fit-on-load is ARTWORK
// behaviour — scale the image to fill the area, then centre it. That is right for the one sign
// drawing a proposal carries, and wrong here, because the second document would land on top of the
// first, both centred, both full-bleed. Two files dropped in a row must be visibly two files. So
// this page seeds each image's geometry from the image's own natural size the moment it loads, and
// AdjImg — which skips its auto-fit whenever a `lay` already exists — is left to do what it is
// actually needed for: dragging, resizing and clamping. The proposal's artwork path is untouched.
const CELL_W = 336          // two columns inside the 736-wide canvas, with a gutter
const seedLay = (n, naturalW, naturalH) => {
  const ratio = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : 4 / 3
  const w = CELL_W
  const h = Math.max(40, Math.round(w / ratio))
  const col = n % 2
  const row = Math.floor(n / 2)
  // Rows step by a nominal cell height rather than by the image's own, so a tall document does not
  // push everything after it off the sheet. Overlap on a crowded page is the rep's to sort out by
  // dragging — that is the point of the feature — but nothing may start outside the paper.
  const x = Math.min(CANVAS_W - w, 16 + col * (CELL_W + 32))
  const y = Math.min(Math.max(0, CANVAS_H - h), 16 + row * 300)
  return { x, y, w, h, rot: 0, ix: 0, iy: 0, iw: w, ih: h }
}

const ClientDocPage = forwardRef(function ClientDocPage({
  // docs: [{ id, path, lay }] — the page's documents in stacking order. `lay` is AdjImg geometry
  //   in unscaled 816×1056 page pixels, null until the rep moves or resizes the image.
  // onPick(FileList|File[]) — one call carries every file chosen, so a multi-select is one upload
  //   batch and one save rather than a race of single patches.
  // onLay(id, box) — persist one image's geometry. onRemoveDoc(id) — take one image off the page.
  docs = [], busy, onPick, onLay, onRemoveDoc, readOnly = false, errorText = '',
}, fwdRef) {
  const wrapRef = useRef(null)
  const sheetRefs = useRef([])
  const fileInput = useRef(null)
  const [scale, setScale] = useState(1)
  const [rendered, setRendered] = useState({})   // { [docId]: [src, …] } — rasterised pages per doc
  const [loadErr, setLoadErr] = useState('')
  const [rasterizing, setRasterizing] = useState(false)
  const [selId, setSelId] = useState(null)       // which image shows its handles

  // AdjImg divides every pointer delta by this, so a drag tracks the cursor at any zoom. It reads
  // a REF (not the number) because the handler closures outlive a re-render.
  const scaleRef = useRef(scale)
  scaleRef.current = scale

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

  // Turn whatever was uploaded into image srcs the sheet can show AND html-to-image can capture.
  // A PDF must be rasterised: an <iframe> renders on screen but exports as an empty box, which
  // would silently ship blank pages to the customer.
  //
  // Keyed on the PATHS, not the docs array: moving or resizing an image rewrites `docs` on every
  // gesture, and re-rasterising a PDF mid-drag would stutter the page and lose the pointer.
  const pathKey = docs.map((d) => d.path).join('|')
  useEffect(() => {
    let alive = true
    setLoadErr('')
    if (!docs.length) { setRendered({}); return }
    const pending = []
    const next = {}
    for (const d of docs) {
      if (!d.path) continue
      if (isCloudDoc(d.path)) {
        // Cloudinary-hosted PDF/AI: the CDN rasterises page 1 for us. Page count is not knowable
        // from the URL, so these stay one page (same limit the wizard's drawing viewer has).
        next[d.id] = [cloudRaster(d.path, 1600)]
      } else if (!/\.pdf($|\?)/i.test(d.path)) {
        next[d.id] = [fileUrl(d.path)]
      } else {
        pending.push(
          rasterizePdfPages(fileUrl(d.path), 2)
            .then((urls) => { next[d.id] = urls.length ? urls : [] })
            .catch(() => { next[d.id] = [] }),
        )
      }
    }
    if (!pending.length) { setRendered(next); return }
    setRasterizing(true)
    Promise.all(pending)
      .then(() => {
        if (!alive) return
        setRendered(next)
        if (docs.some((d) => next[d.id] && next[d.id].length === 0)) {
          setLoadErr('A PDF could not be rendered here — open the file directly to check it.')
        }
      })
      .finally(() => { if (alive) setRasterizing(false) })
    return () => { alive = false }
  }, [pathKey])   // eslint-disable-line react-hooks/exhaustive-deps

  // One capture per SHEET, in order. Screen-only chrome is hidden for the shot: .doc-ui is this
  // page's own, .adj-ui is every AdjImg's handles — miss either class and the customer receives a
  // PDF with drag handles printed on it.
  const renderSheet = async (el, pixelRatio) => {
    const chrome = [...el.querySelectorAll('.doc-ui, .adj-ui')]
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
    hasDoc: () => docs.length > 0,
    captureSnapshot: () => captureEach(2, false),
    captureExport: () => captureEach(HD_SCALE, true),
  }))

  // The document's sheets. Sheet 0 is the free canvas carrying every image's FIRST page; a
  // multi-page PDF contributes its remaining pages as extra sheets straight after, centered.
  // An empty attachment page is still a page: it renders as a blank sheet (that is what was asked
  // for) and carries the dropzone until a file arrives.
  const overflowSheets = useMemo(() => (
    docs.flatMap((d) => (rendered[d.id] || []).slice(1).map((src) => ({ src, docId: d.id })))
  ), [docs, rendered])
  const sheetCount = 1 + overflowSheets.length
  sheetRefs.current = sheetRefs.current.slice(0, sheetCount)

  // Seed geometry for any document that has none yet, from the image's natural size. One write per
  // document, tracked so a re-render cannot re-seed one the rep has since moved.
  const seededRef = useRef(new Set())
  useEffect(() => {
    if (readOnly || !onLay) return
    docs.forEach((d, i) => {
      if (d.lay || seededRef.current.has(d.id)) return
      const src = (rendered[d.id] || [])[0]
      if (!src) return
      seededRef.current.add(d.id)
      const probe = new Image()
      probe.crossOrigin = 'anonymous'
      probe.onload = () => onLay(d.id, seedLay(i, probe.naturalWidth, probe.naturalHeight))
      probe.onerror = () => onLay(d.id, seedLay(i, 4, 3))
      probe.src = src
    })
  }, [docs, rendered, readOnly])   // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (files) => {
    const list = [...(files || [])].filter(Boolean)
    if (list.length && onPick) onPick(list)
  }

  // Shared chrome for one sheet: the letterhead band. Printed on EVERY sheet of this kind — a blank
  // page is not a scrap of paper the customer receives loose, it travels inside the same PDF as the
  // proposal, so it carries the same logo and address block in the same geometry as Proposal.jsx's
  // header (70px band, 52px logo, 9px address right-aligned at top 12). Fixed, not editable: this
  // is the company's own identity, and the editable copy on the proposal page is where a correction
  // belongs.
  const letterhead = (
    <div style={{ height: 70, position: 'relative', padding: '0 40px', display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
      <img src="/quote-logo.png" alt="Epic Craftings" crossOrigin="anonymous"
        style={{ height: 52, objectFit: 'contain', display: 'block' }} />
      {/* uppercase to match the proposal sheet, where the page's own CSS raises it — without
          this the same address prints lower-case on one page and upper-case on the next. */}
      <div style={{ position: 'absolute', right: 40, top: 12, fontSize: 9, textAlign: 'right', lineHeight: '15px', textTransform: 'uppercase' }}
        dangerouslySetInnerHTML={{ __html: ORG_ADDRESS_HTML }} />
    </div>
  )

  const sheetBox = (n, children) => (
    <div key={n} style={{ width: PAGE_W * scale, height: PAGE_H * scale, overflow: 'hidden', margin: '0 auto' }}>
      <div
        ref={(el) => { sheetRefs.current[n] = el }}
        style={{
          width: PAGE_W, height: PAGE_H, background: '#fff', color: '#111',
          transform: `scale(${scale})`, transformOrigin: 'top left',
          display: 'flex', flexDirection: 'column', position: 'relative',
          fontFamily: 'Roboto, Arial, sans-serif',
          boxSizing: 'border-box',
          border: '1px solid var(--border, #d8dee8)',
        }}
      >
        {letterhead}
        {children}
      </div>
    </div>
  )

  return (
    // ALIGNED WITH THE PROPOSAL SHEET, NOT MERELY THE SAME SIZE. Proposal.jsx renders its page
    // inside `.proposal-fit` at `width: 816 * scale; margin: 0 auto` — CENTERED in its column. This
    // sheet was the right 816×1056 at the right scale but sat hard left, so the moment the column
    // grew wider than 816px (any normal desktop) the two pages stood at different offsets and read
    // as two different documents in one stack. Each sheet below therefore gets the same width box,
    // the same auto margins, and the same 1px edge + border-box sizing as the proposal page.
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      {/* Controls live ABOVE the sheet, never on it. They used to sit at top-right INSIDE the page,
          which was empty space until the letterhead arrived — and with images now placed anywhere
          on the sheet there is no corner that stays empty. Outside the paper they cannot collide
          with its contents whatever it grows to hold. On the wrapper, not a sheetRef, so the export
          cannot pick them up either. */}
      {!readOnly && docs.length > 0 && (
        <div className="doc-ui" style={{ width: PAGE_W * scale, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#8a8a8a' }}>
            {docs.length === 1 ? '1 document' : `${docs.length} documents`} — drag to move, corners to resize
          </span>
          <button className="doc-ui" disabled={busy} onClick={() => fileInput.current?.click()}
            style={{ marginLeft: 'auto', padding: '4px 9px', borderRadius: 6, border: '1px solid #777', background: '#fff', color: '#111', cursor: 'pointer', fontSize: 11 }}>
            {busy ? 'Uploading…' : '＋ Add documents'}
          </button>
          <button className="doc-ui" disabled={busy || !selId} onClick={() => { if (selId && onRemoveDoc) { onRemoveDoc(selId); setSelId(null) } }}
            title={selId ? 'Take the selected document off this page' : 'Select a document on the sheet first'}
            style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #e05661', background: '#fff', color: selId ? '#e05661' : '#c9a0a4', cursor: selId ? 'pointer' : 'default', fontSize: 11 }}>
            Remove selected
          </button>
        </div>
      )}

      {/* SHEET 0 — the free canvas. Clicking bare paper clears the selection, which is what makes
          "Remove selected" safe to sit in a toolbar: there is always a way to select nothing. */}
      {sheetBox(0, (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelId(null) }}
          style={{ flex: 1, minHeight: 0, margin: '14px 40px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        >
          {docs.map((d, i) => {
            const src = (rendered[d.id] || [])[0]
            if (!src) return null
            // Read-only (the View modal) draws the same geometry with a plain image: no handles to
            // hide, no state to mutate on a screen that only reports. A legacy document that never
            // got geometry still shows, centred, exactly as it did before this page held a list.
            if (readOnly) {
              return d.lay
                ? <img key={d.id} src={src} alt={`Client document ${i + 1}`}
                    style={{ position: 'absolute', left: d.lay.x, top: d.lay.y, width: d.lay.w, height: d.lay.h, objectFit: 'contain' }} />
                : <img key={d.id} src={src} alt={`Client document ${i + 1}`}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            }
            // Nothing is drawn for the blink between upload and seeding — better a beat of empty
            // paper than an image that jumps once the real geometry lands.
            if (!d.lay) return null
            return (
              <AdjImg
                key={d.id}
                rk={d.id}
                def={d.lay}
                lay={d.lay}
                onLay={(box) => onLay && onLay(d.id, box)}
                src={src}
                alt={`Client document ${i + 1}`}
                lockAspect
                liveLay
                scaleRef={scaleRef}
                selected={selId === d.id}
                onSelect={() => !readOnly && setSelId(d.id)}
                bounds={{ w: CANVAS_W, h: CANVAS_H }}
                cors={/res\.cloudinary\.com/i.test(src || '')}
              />
            )
          })}

          {!docs.length && (
            // screen-only: nothing here prints, so an untouched page exports as a blank sheet
            <div className="doc-ui" style={{ textAlign: 'center', color: '#8a8a8a', fontSize: 13 }}>
              {rasterizing ? 'Rendering the document…' : (
                readOnly ? 'No client document attached.' : <>
                  <div style={{ fontSize: 30, marginBottom: 6 }}>📄</div>
                  <div style={{ fontWeight: 600, color: '#555' }}>Attach the client&rsquo;s documents</div>
                  <div style={{ marginTop: 4 }}>PDFs or images — their spec sheets or drawings, to check against ours</div>
                  <div style={{ marginTop: 2, fontSize: 12 }}>Pick several at once; place and size each one on the sheet.</div>
                  <button className="doc-ui" disabled={busy}
                    onClick={() => fileInput.current?.click()}
                    style={{ marginTop: 12, padding: '7px 14px', borderRadius: 7, border: '1px solid #777', background: '#fff', color: '#111', cursor: 'pointer', fontSize: 13 }}>
                    {busy ? 'Uploading…' : 'Choose files'}
                  </button>
                </>
              )}
            </div>
          )}
          {(loadErr || errorText) && <div className="doc-ui" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', color: '#c0392b', fontSize: 12 }}>{loadErr || errorText}</div>}
        </div>
      ))}

      {/* Pages 2..n of any multi-page PDF, centered as they always were. They are the customer's
          own file continuing — not something the rep composed — so they are not draggable. */}
      {overflowSheets.map((sheet, i) => sheetBox(i + 1, (
        <div style={{ flex: 1, minHeight: 0, margin: '14px 40px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <img src={sheet.src} alt="Client document continued"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )))}

      <input ref={fileInput} type="file" accept="application/pdf,image/*" multiple style={{ display: 'none' }}
        onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
    </div>
  )
})

export default ClientDocPage
