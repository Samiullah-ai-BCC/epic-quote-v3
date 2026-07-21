import { useEffect, useState } from 'react'
import client, { fileUrl } from '../../api/client'

// Files carousel (#15): EVERY artwork the quote has ever had — the live art on each sign PLUS
// older uploads that were later replaced (the backend mines version snapshots for those), the
// customer file and the crunched artwork — paged with ‹ ›. PDFs show as an open-in-tab card.
export default function ArtCarousel({ quote, onClose }) {
  const [files, setFiles] = useState(null)
  const [i, setI] = useState(0)
  useEffect(() => {
    let alive = true
    client.get(`/quotes/${quote.quote_id}/artworks`).then(({ data }) => {
      if (!alive) return
      const list = (data?.artworks || []).map((a) => ({ label: a.label, url: fileUrl(a.url), isPdf: /\.pdf($|\?)/i.test(a.url) }))
      setFiles(list)
    }).catch(() => {
      // endpoint unreachable — fall back to whatever the quote row already carries
      const list = []
      if (quote.artwork_url) list.push({ label: 'Artwork', url: fileUrl(quote.artwork_url), isPdf: false })
      if (quote.customer_pdf) list.push({ label: 'Customer file', url: fileUrl(quote.customer_pdf), isPdf: /\.pdf($|\?)/i.test(quote.customer_pdf) })
      setFiles(list)
    })
    return () => { alive = false }
  }, [quote])

  // ‹ › arrow keys page the files too (same golden-principle nav as the proposal carousel).
  useEffect(() => {
    if (!files || files.length <= 1) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      else if (e.key === 'ArrowRight') setI((n) => Math.min(files.length - 1, n + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [files])

  const f = files && files[Math.min(i, files.length - 1)]
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal flex max-h-[88vh] w-[720px] flex-col">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="m-0">Files — {quote.quote_id}</h2>
          <button className="ghost sm" onClick={onClose}>Close</button>
        </div>
        {!files && <div className="center p-[30px]">Loading files…</div>}
        {files && files.length === 0 && <div className="muted p-5">No files on this quote.</div>}
        {f && (
          <>
            <div className="mb-2 flex items-center justify-center gap-3">
              <button className="ghost sm" disabled={i === 0} onClick={() => setI(i - 1)}>‹ Prev</button>
              <b className="text-[13px]">{f.label} — {i + 1} of {files.length}</b>
              <button className="ghost sm" disabled={i === files.length - 1} onClick={() => setI(i + 1)}>Next ›</button>
            </div>
            {f.isPdf
              ? <div className="center rounded-lg border border-dashed border-line p-10">
                  <a href={f.url} target="_blank" rel="noreferrer">📄 Open {f.label} (PDF)</a>
                </div>
              : <img src={f.url} alt={f.label}
                  className="max-h-[62vh] w-full rounded-lg border border-line bg-white object-contain" />}
            <a className="muted mt-2 text-xs" href={f.url} target="_blank" rel="noreferrer">Open original in a new tab ↗</a>
          </>
        )}
      </div>
    </div>
  )
}
