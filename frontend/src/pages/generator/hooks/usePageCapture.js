import { useRef } from 'react'

// Capturing each sign page's rendered Proposal — used for the combined payment link (clean
// product images), the version-history checkpoint (one stitched image of the whole quote),
// and the multi-page PDF/PNG download. Every page's Proposal instance is kept in `pageRefs`,
// keyed by its stable part id, so these can pull from EVERY sign in page order.
export function usePageCapture(parts) {
  const pageRefs = useRef({})
  const proposalRef = useRef(null)   // LAST-page Proposal, for capturing the version snapshot image
  const multiPreviewRef = useRef(null)   // wraps all stacked pages — captured whole for the version image

  // Clean product image for EVERY sign, in page order (skips any that fail to render).
  const collectPartImages = async () => {
    const images = []
    for (const part of parts) {
      const pageHandle = pageRefs.current[part.__pid]
      if (pageHandle?.captureCleanImage) { try { images.push(await pageHandle.captureCleanImage()) } catch { /* skip a bad page */ } }
    }
    return images
  }

  // The WHOLE quote as one image for the version history: each page's full snapshot (last page
  // carries the total) stacked vertically with a grey gap between pages, so a multi-sign version
  // reads as the complete document. A single-sign quote just returns its one page.
  const captureAllPages = async () => {
    const snapshots = []
    for (const part of parts) {
      const pageHandle = pageRefs.current[part.__pid]
      if (pageHandle?.captureSnapshot) { try { snapshots.push(await pageHandle.captureSnapshot()) } catch { /* skip */ } }
    }
    if (snapshots.length <= 1) return snapshots[0] || null
    const images = (await Promise.all(snapshots.map((imageSrc) => new Promise((resolve) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = imageSrc
    })))).filter(Boolean)
    if (!images.length) return null
    const GAP = 26
    const width = Math.max(...images.map((image) => image.width))
    const height = images.reduce((sum, image) => sum + image.height, 0) + GAP * (images.length - 1)
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')
    context.fillStyle = '#e9edf3'; context.fillRect(0, 0, width, height)   // grey between pages = page separators
    let yOffset = 0
    for (const image of images) { context.drawImage(image, Math.round((width - image.width) / 2), yOffset); yOffset += image.height + GAP }
    return canvas.toDataURL('image/png')
  }

  // Every sign page at HD ({url,w,h}) for the multi-page download (PDF = one page each; PNG stitched).
  const capturePagesExport = async () => {
    const exports = []
    for (const part of parts) {
      const pageHandle = pageRefs.current[part.__pid]
      if (pageHandle?.captureExport) { try { exports.push(await pageHandle.captureExport()) } catch { /* skip */ } }
    }
    return exports
  }

  return { pageRefs, proposalRef, multiPreviewRef, collectPartImages, captureAllPages, capturePagesExport }
}
