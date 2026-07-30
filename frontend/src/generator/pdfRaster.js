import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

/* Render page 1 of a PDF (fetched by URL) to a PNG data URL, so vector/CAD drawings
   that carry no extractable text can still be read by the vision model + shown as artwork.
   Returns null on any failure (caller falls back to text extraction). */
export async function rasterizePdf(url, scale = 2) {
  try {
    const buf = await (await fetch(url)).arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buf }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    return canvas.toDataURL('image/png')
  } catch (e) {
    console.error('rasterizePdf failed:', e)
    return null
  }
}

/* Render EVERY page of a PDF to PNG data URLs, in order.
   The client-document sheets need this: a customer's spec drawing is routinely a 3–6 page PDF, and
   showing only page 1 would defeat the whole purpose of the page (checking OUR spec against ALL of
   THEIRS). `max` is a sanity brake — a 60-page catalog would otherwise mint 60 proposal sheets and
   60 HD canvases at export time.
   Returns [] on any failure; the caller shows the file as a plain link instead. */
export async function rasterizePdfPages(url, scale = 2, max = 12) {
  try {
    const buf = await (await fetch(url)).arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buf }).promise
    const out = []
    const count = Math.min(pdf.numPages, max)
    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      out.push(canvas.toDataURL('image/png'))
    }
    return out
  } catch (e) {
    console.error('rasterizePdfPages failed:', e)
    return []
  }
}
