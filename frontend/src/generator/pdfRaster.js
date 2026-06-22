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
