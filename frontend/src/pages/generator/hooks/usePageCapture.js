import { useRef } from 'react'

// Capturing each sign page's rendered Proposal — used for the combined payment link (clean
// product images), the version-history checkpoint (one image PER page, browsed as a carousel),
// and the multi-page PDF/PNG download. Every page's Proposal instance is kept in `pageRefs`,
// keyed by its stable part id, so these can pull from EVERY sign in page order.
export function usePageCapture(parts) {
  const pageRefs = useRef({})
  // The CLIENT DOCUMENT sheet(s) that hang off each sign page, keyed by the same part id. Their
  // capture handles return ARRAYS (a customer PDF is often several pages), and they are emitted
  // DIRECTLY AFTER their own sign page everywhere below — the whole point is the pair being read
  // together, so the order is part of the feature, not a detail.
  const docRefs = useRef({})
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

  // EVERY sign page's full snapshot, in page order, for the version-history checkpoint image.
  // Used to be stitched into one tall composite PNG (all pages stacked vertically) — unreadable
  // at a glance for a multi-sign quote, and the whole point of a version snapshot is seeing it
  // at first sight. Now returns the pages as a plain array; the History modal renders them as a
  // carousel (one page at a time, ‹ › between pages) instead of a scroll-forever stack.
  const captureAllPages = async () => {
    const snapshots = []
    for (const part of parts) {
      const pageHandle = pageRefs.current[part.__pid]
      if (pageHandle?.captureSnapshot) { try { snapshots.push(await pageHandle.captureSnapshot()) } catch { /* skip a bad page */ } }
      const docHandle = docRefs.current[part.__pid]
      if (docHandle?.hasDoc?.()) {
        try { snapshots.push(...(await docHandle.captureSnapshot())) } catch { /* skip a bad sheet */ }
      }
    }
    return snapshots
  }

  // Every sign page at HD ({url,w,h,index}) for the multi-page download (PDF = one page each).
  //
  // `indices` picks WHICH pages to export (the download page-picker); null/omitted keeps the old
  // behaviour of every page, so every existing caller is unaffected. `index` is the page's position
  // in the WHOLE quote, not in the returned array — exporting only pages A and C must still name
  // them A and C, not re-letter them A and B.
  const capturePagesExport = async (indices = null) => {
    const wanted = Array.isArray(indices) ? new Set(indices) : null
    const exports = []
    for (const [index, part] of parts.entries()) {
      if (wanted && !wanted.has(index)) continue
      const pageHandle = pageRefs.current[part.__pid]
      if (pageHandle?.captureExport) {
        // kind:'sign' matters downstream: the clickable payment-link annotation must land on the
        // last SIGN sheet, which is no longer the last sheet in the file once a client document
        // follows it.
        try { exports.push({ ...(await pageHandle.captureExport()), index, kind: 'sign' }) } catch { /* skip */ }
      }
      const docHandle = docRefs.current[part.__pid]
      if (docHandle?.hasDoc?.()) {
        try {
          for (const sheet of await docHandle.captureExport()) exports.push({ ...sheet, index, kind: 'doc' })
        } catch { /* skip */ }
      }
    }
    return exports
  }

  return { pageRefs, docRefs, proposalRef, multiPreviewRef, collectPartImages, captureAllPages, capturePagesExport }
}
