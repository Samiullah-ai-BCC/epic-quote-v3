import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getRevisions, getGenerated } from '../../api/quotes'
import { getBankDetails } from '../../api/meta'
import Proposal from '../Proposal'
import ClientDocPage from '../generator/ClientDocPage'
import { resolveTplByName, itemSigned } from '../../generator/parts'
import { normalizeBlankPages, blankDocs } from '../../pages/generator/hooks/usePageCapture'

// The PROPOSAL itself at the top of the View modal (#7): the latest version image when one
// exists, else the real proposal rendered live from the saved state (read-only) — so View
// always shows the document, never just text.
export default function ViewProposalImage({ quote }) {
  const [img, setImg] = useState(null)
  const [gd, setGd] = useState(null)
  // The wire-transfer details this quote may print. Fetched here too: View renders the same
  // Proposal component, and a sheet that shows the bank block in the editor but not in View would
  // be lying about what the customer receives.
  const [bank, setBank] = useState(null)
  const [page, setPage] = useState(0)
  // Fit-to-viewport (#2): the proposal renders at its natural 816px width (~1056px+ tall). To show
  // the WHOLE page in one go — no inner scrollbar — we measure the rendered height and scale the
  // page down so it fits inside the modal viewport. Height is the constraint; width always fits.
  const contentRef = useRef(null)
  const [fit, setFit] = useState(1)
  const [contentH, setContentH] = useState(0)
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => {
      const h = el.scrollHeight
      if (!h) return
      // modal viewport (90vh) minus the modal chrome: padding, the "Quote …" heading, the
      // page-carousel bar, and margins. Conservative so the whole thing never scrolls.
      const availH = window.innerHeight * 0.9 - 150
      setContentH(h)
      setFit(Math.min(1, availH / h))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [gd, page])
  useEffect(() => {
    let alive = true
    setImg(null); setGd(null); setPage(0)
    // Silent on failure: the rest of the proposal is still worth showing, and a quote that prints
    // no bank block is the same as one that never asked for it.
    getBankDetails().then((b) => { if (alive) setBank(b) }).catch(() => {})
    // the live per-page render is primary (it pages sign-by-sign); the latest version image is
    // the fallback for quotes whose generated data can't load.
    getGenerated(quote.quote_id)
      .then((g) => { if (alive) setGd(g || {}) })
      .catch(() => getRevisions(quote.quote_id).then((d) => {
        if (alive) setImg((d?.checkpoints || []).find((c) => c.snapshot_image)?.snapshot_image || null)
      }).catch(() => {}))
    return () => { alive = false }
  }, [quote.quote_id])

  // ‹ › arrow keys page through a multi-sign quote — the rep expects the keyboard to work, not
  // only the on-screen buttons (Sami's golden principle: one task, every natural way to do it).
  useEffect(() => {
    const parts = (Array.isArray(gd?.parts) && gd.parts.length) ? gd.parts : (gd ? [gd] : [])
    if (parts.length <= 1) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPage((p) => Math.min(parts.length - 1, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gd])

  if (gd) {
    // IMAGES ONLY (#12): the proposal itself, one page at a time — a multi-sign quote pages
    // through A/B/… with ‹ › (a "multi-page wizard"), read-only.
    const parts = (Array.isArray(gd.parts) && gd.parts.length) ? gd.parts : [gd]
    const total = parts.reduce((s, p) => {
      const price = Number(p?.custom_spec?.price ?? p?.answers?.price) || 0
      const q = Math.max(1, parseInt(p?.proposal_state?.__qty ?? p?.custom_spec?.qty ?? p?.answers?.qty ?? 1, 10) || 1)
      const extras = (Array.isArray(p?.proposal_state?.__items) ? p.proposal_state.__items : [])
        .reduce((a, it) => a + itemSigned(it), 0)
      return s + Math.max(0, price * q + extras)
    }, 0)
    const info = { company: quote.company_name, client: quote.client_name, contact: quote.contact, email: quote.email, address: quote.address, job: quote.job_name, quoteId: quote.quote_id }
    const multi = parts.length > 1
    const i = Math.min(page, parts.length - 1)
    const p = parts[i]
    // Blank pages are independent sheets with their own place in the document, so View shows the
    // ones that sit at THIS page's slot (and, on the last page, the ones parked at the end).
    // normalizeBlankPages reads legacy quotes — where the sheet was a flag on the part — forward
    // into the same shape, so nothing attached before this change disappears from the one screen
    // people check a quote on. Read-only here: attaching/replacing happens in the wizard.
    const blanks = normalizeBlankPages(parts, gd.blank_pages)
    const blanksHere = blanks.filter((b) => {
      const at = Number(b.at) || 0
      return at === i || (i === parts.length - 1 && at >= parts.length)
    })
    return (
      <div className="mb-3">
        {multi && (
          <div className="mb-2 flex items-center justify-center gap-3">
            <button className="ghost sm" disabled={i === 0} onClick={() => setPage(i - 1)}>‹ Prev</button>
            <b className="text-[13px]">Page {String.fromCharCode(65 + i)} of {String.fromCharCode(65 + parts.length - 1)}</b>
            <button className="ghost sm" disabled={i === parts.length - 1} onClick={() => setPage(i + 1)}>Next ›</button>
          </div>
        )}
        {/* The COMPLETE page in one go, scaled to fit the modal viewport (#2) — no inner slider.
            The outer box reserves the scaled height; the inner 816px page is scaled by `fit`.
            pointer-events-none keeps it read-only. */}
        <div className="flex justify-center overflow-hidden" style={{ height: contentH ? contentH * fit : undefined }}>
          <div ref={contentRef} className="pointer-events-none w-[816px] origin-top rounded-lg border border-line" style={{ transform: `scale(${fit})`, transformOrigin: 'top center' }}>
          {/* specialRequirements is the quote-level caveat and prints on the FIRST sign page only,
              the same rule the editor uses — otherwise View would show it on every page while the
              exported PDF shows it once. */}
          <Proposal
            key={i}
            readOnly
            mode={p.quote_type || gd.quote_type || 'custom'}
            tpl={p.tpl_name ? resolveTplByName(p.tpl_name, p.tpl_stored_spec || null) : null}
            answers={p.answers || {}}
            customSpec={p.custom_spec}
            info={info}
            artworkPath={p.artwork_path}
            savedState={p.proposal_state}
            sideViews={p.side_views || []}
            paymentLink={gd.payment_link}
            paymentLinkKind={gd.payment_link_kind}
            paymentLinkVisible={gd.payment_link_visible !== false}
            paymentDisplay={quote.payment_display}
            bankDetails={bank}
            proposalNotes={p.proposal_notes}
            specialRequirements={p.special_requirements ?? (i === 0 ? (quote.special_requirements || '') : '')}
            partLabel={multi ? String.fromCharCode(65 + i) : null}
            multi={multi}
            isLast={i === parts.length - 1}
            quoteTotal={multi ? total : null}
          />
          {/* The client's own document belongs to the page, so View must show it too — otherwise the
              one screen people check a quote on is the one screen that hides half of it. Read-only
              here: attaching/replacing happens in the wizard. */}
          {blanksHere.map((blank) => (
            <div key={blank.__bid} style={{ marginTop: 26 }}>
              <ClientDocPage readOnly docs={blankDocs(blank)} />
            </div>
          ))}
          </div>
        </div>
      </div>
    )
  }
  if (img) return (
    <img src={img} alt="Latest proposal" className="mb-3 max-h-[460px] w-full rounded-lg border border-line bg-white object-contain object-top" />
  )
  return null
}
