import { useRef } from 'react'

// THE DOCUMENT'S SHEET ORDER — the one place that decides what sits where.
//
// A sign page can carry a BLANK PAGE: the client-document sheet, the one with the "attach the
// client's document" input on it. It is the same sheet it has always been; what changed is that
// it is now OPT-IN (the rep clicks "＋ Add blank page") and that it sits IN FRONT of its sign
// rather than under it.
//
// Opt-in via `blank_page` on the part. `client_doc` counts too, and that is not belt-and-braces:
// every quote written before the button existed has a document attached with no flag beside it,
// and dropping those sheets out of the preview and out of the PDF would be silent data loss on
// live quotes.
export const hasBlankPage = (part) => !!(part?.blank_page || part?.client_doc)

/**
 * Sheets in printed order: a part's blank page, then the part.
 *
 * Entries are { kind: 'blank'|'sign', part, index, seq }, where
 *   index = the part's position in `parts` — i.e. the page's LETTER, and
 *   seq   = the sheet's position in the whole document — what the page-picker lists.
 *
 * The two are deliberately separate and must not be conflated. The letter is a fact about the
 * SIGNS; the picker and the PDF count SHEETS. Once a blank page exists they diverge, and reading
 * one for the other is what would letter a sheet wrongly or drop the payment link onto the wrong
 * page. A blank shares its sign's `index` (it belongs to that page) but never takes its letter.
 */
export function pageSequence(parts) {
  const seq = []
  for (const [index, part] of (parts || []).entries()) {
    if (hasBlankPage(part)) seq.push({ kind: 'blank', part, index, seq: seq.length })
    seq.push({ kind: 'sign', part, index, seq: seq.length })
  }
  return seq
}

// Capturing each sign page's rendered Proposal — used for the combined payment link (clean
// product images), the version-history checkpoint (one image PER page, browsed as a carousel),
// and the multi-page PDF/PNG download. Every page's Proposal instance is kept in `pageRefs`,
// keyed by its stable part id, so these can pull from EVERY sign in page order.
export function usePageCapture(parts) {
  const pageRefs = useRef({})
  // The BLANK PAGE (client-document sheet) belonging to each sign page, keyed by the same part id.
  // Its capture handle returns an ARRAY (a customer PDF is often several sheets), and it is
  // emitted DIRECTLY BEFORE its own sign page everywhere below — the order is the feature, not a
  // detail, so it lives in exactly one place: pageSequence.
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
    for (const entry of pageSequence(parts)) {
      if (entry.kind === 'blank') {
        const docHandle = docRefs.current[entry.part.__pid]
        if (docHandle?.hasDoc?.()) {
          try { snapshots.push(...(await docHandle.captureSnapshot())) } catch { /* skip a bad sheet */ }
        }
        continue
      }
      const pageHandle = pageRefs.current[entry.part.__pid]
      if (pageHandle?.captureSnapshot) { try { snapshots.push(await pageHandle.captureSnapshot()) } catch { /* skip a bad page */ } }
    }
    return snapshots
  }

  // Every sheet at HD ({url,w,h,index,kind}) for the multi-page download (PDF = one page each).
  //
  // `indices` picks WHICH sheets to export (the download page-picker); null/omitted keeps the old
  // behaviour of the whole document, so every existing caller is unaffected. The numbers it
  // carries are `seq` — positions in the DOCUMENT, matching the labels the picker was given —
  // while the `index` put on each exported sheet stays its part's position, i.e. its LETTER.
  // Exporting only page C must still name it C rather than re-lettering it A.
  const capturePagesExport = async (indices = null) => {
    const wanted = Array.isArray(indices) ? new Set(indices) : null
    const exports = []
    for (const entry of pageSequence(parts)) {
      if (wanted && !wanted.has(entry.seq)) continue

      if (entry.kind === 'blank') {
        const docHandle = docRefs.current[entry.part.__pid]
        if (docHandle?.hasDoc?.()) {
          // kind:'doc' matters downstream: these sheets are not signs, so they must never be
          // lettered and never counted when finding the last sign page.
          try {
            for (const sheet of await docHandle.captureExport()) exports.push({ ...sheet, index: entry.index, kind: 'doc' })
          } catch { /* skip a sheet rather than losing the whole export */ }
        }
        continue
      }

      const pageHandle = pageRefs.current[entry.part.__pid]
      if (pageHandle?.captureExport) {
        // kind:'sign' matters downstream: the clickable payment-link annotation must land on the
        // last SIGN sheet, which is not the last sheet in the file once blank pages exist.
        try { exports.push({ ...(await pageHandle.captureExport()), index: entry.index, kind: 'sign' }) } catch { /* skip */ }
      }
    }
    return exports
  }

  return { pageRefs, docRefs, proposalRef, multiPreviewRef, collectPartImages, captureAllPages, capturePagesExport }
}
