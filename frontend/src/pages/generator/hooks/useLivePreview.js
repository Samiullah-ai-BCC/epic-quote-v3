import { useEffect, useRef, useState } from 'react'

// ---- live preview beside the wizard (boss demand): the REAL editable proposal, refreshed
// whenever wizard data changes. Remounting on a debounced key keeps two guarantees: fresh
// wizard data always flows in, and typing INSIDE the preview never gets clobbered (edits
// auto-save to proposal_state, which the remount restores dirty-first).
export function useLivePreview({ mode, parts, activePart, answers, client, customSpec, template, sideViews, artworkPath, proposalNotes, paymentLink, aiResult }) {
  const [previewKey, setPreviewKey] = useState(0)
  const previewSig = JSON.stringify([answers, client, customSpec, template?.n, sideViews, artworkPath, proposalNotes, paymentLink, aiResult?.fullSpec])
  const prevSig = useRef(previewSig)
  useEffect(() => {
    if (prevSig.current === previewSig) return
    prevSig.current = previewSig
    const timer = setTimeout(() => setPreviewKey((k) => k + 1), 600)
    return () => clearTimeout(timer)
  }, [previewSig])

  // The active part's proposal_state for the LIVE preview, with __qty forced to the wizard's
  // Quantity field — so QTY/TOTAL update on the wizard steps, not only on the preview page (#5).
  // (Price flows straight from customSpec, so it was already live.)
  const livePreviewState = () => {
    const proposalState = parts[activePart]?.proposal_state || {}
    const wizardQuantity = parseInt(mode === 'custom' ? customSpec?.qty : answers?.qty, 10)
    return Number.isFinite(wizardQuantity) && wizardQuantity > 0 ? { ...proposalState, __qty: wizardQuantity } : proposalState
  }

  return { previewKey, livePreviewState }
}
