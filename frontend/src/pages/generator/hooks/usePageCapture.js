import { useRef } from 'react'

// THE DOCUMENT'S SHEET ORDER — the one place that decides what sits where.
//
// A BLANK PAGE is the client-document sheet — the one with the "attach the client's document"
// input on it. It is INDEPENDENT of the sign pages: its own record, its own id, its own place in
// the document. It used to be a flag ON a part, which capped the quote at one blank page per sign
// and welded it to that sign forever; a rep who wanted two documents in front of page A, or the
// same sheet moved behind page B, had no way to say so.
//
// A blank page is NOT a sign: no letter, no PROPOSAL ID suffix, no share of the total, no entry
// anywhere `parts` is counted. Its only positional fact is `at` — how many SIGN pages sit in front
// of it. `at: 0` is the top of the document; `at: parts.length` is the very end. Several blanks can
// share one `at`; their array order breaks the tie, and that is what ↑/↓ reorders.
export const BLANK_AT_END = (parts) => (parts || []).length

// Legacy quotes stored the blank page as `blank_page`/`client_doc` ON the part. Those must keep
// rendering and keep exporting — dropping them would be silent data loss on live quotes — so they
// are read forward into the independent shape, in place, every time the document is built. The
// derived id is stable (it is the part's own id), so refs and ↑/↓ work on a legacy blank exactly
// like a new one; the first blank-page action of the session writes the normalized list back.
export const hasBlankPage = (part) => !!(part?.blank_page || part?.client_doc)

// A blank page's documents, read forward from every shape the field has had. `client_doc` was a
// single path; `docs` is the list that replaced it (2026-08, multi-upload + free placement). Old
// quotes keep rendering and keep exporting through this one function — the same contract
// normalizeBlankPages has for the pages themselves. Every reader calls this; nobody touches
// `client_doc` directly any more.
export function blankDocs(blank) {
  if (Array.isArray(blank?.docs)) return blank.docs
  return blank?.client_doc ? [{ id: `d_legacy_${blank.__bid}`, path: blank.client_doc, lay: null }] : []
}

export function normalizeBlankPages(parts, blankPages) {
  if (Array.isArray(blankPages)) return blankPages
  return (parts || []).flatMap((part, index) => (
    hasBlankPage(part) ? [{ __bid: `b_legacy_${part.__pid}`, client_doc: part.client_doc || null, at: index }] : []
  ))
}

/**
 * Sheets in printed order: every blank page whose `at` is this slot, then the sign in that slot;
 * blanks with `at === parts.length` close the document.
 *
 * Entries are { kind: 'blank'|'sign', part, blank, index, seq }, where
 *   index = the SIGN's position in `parts` — i.e. the page's LETTER (a blank borrows the index of
 *           the sign it sits in front of purely so exported sheets keep a sensible neighbour;
 *           it never takes that sign's letter), and
 *   seq   = the sheet's position in the whole document — what the page-picker lists.
 *
 * The two are deliberately separate and must not be conflated. The letter is a fact about the
 * SIGNS; the picker and the PDF count SHEETS. Once a blank page exists they diverge, and reading
 * one for the other is what would letter a sheet wrongly or drop the payment link onto the wrong
 * page.
 */
export function pageSequence(parts, blankPages) {
  const list = normalizeBlankPages(parts, blankPages)
  const all = parts || []
  const seq = []
  const pushBlanksAt = (slot) => {
    for (const blank of list) {
      if (Number(blank.at) !== slot) continue
      seq.push({ kind: 'blank', blank, part: all[Math.min(slot, all.length - 1)] || null, index: Math.min(slot, Math.max(all.length - 1, 0)), seq: seq.length })
    }
  }
  for (const [index, part] of all.entries()) {
    pushBlanksAt(index)
    seq.push({ kind: 'sign', part, blank: null, index, seq: seq.length })
  }
  pushBlanksAt(all.length)
  return seq
}

// Capturing each sign page's rendered Proposal — used for the combined payment link (clean
// product images), the version-history checkpoint (one image PER page, browsed as a carousel),
// and the multi-page PDF/PNG download. Every page's Proposal instance is kept in `pageRefs`,
// keyed by its stable part id, so these can pull from EVERY sign in page order.
export function usePageCapture(parts, blankPages) {
  const pageRefs = useRef({})
  // The BLANK PAGES (client-document sheets), keyed by their OWN id — they are independent sheets,
  // not a property of a sign, so they cannot be keyed by a part id: two blanks in front of the same
  // sign would collide on one key and the exporter would capture one sheet twice. Each handle
  // returns an ARRAY (a customer PDF is often several sheets). WHERE each sheet lands is decided in
  // exactly one place — pageSequence — so the preview, the picker and the PDF cannot disagree.
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
    for (const entry of pageSequence(parts, blankPages)) {
      if (entry.kind === 'blank') {
        const docHandle = docRefs.current[entry.blank.__bid]
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
    for (const entry of pageSequence(parts, blankPages)) {
      if (wanted && !wanted.has(entry.seq)) continue

      if (entry.kind === 'blank') {
        const docHandle = docRefs.current[entry.blank.__bid]
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
