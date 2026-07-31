import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { updateQuote, putGenerated, uploadArtwork, uploadCustomerFile, uploadExtraFile, generateSpecs, createCheckpoint } from '../api/quotes'
import { useConstants } from '../hooks'
import { useSelector } from 'react-redux'
import { selectUser, selectIsAdmin } from '../store/authSlice'
import { autoAnswerFromAI, parseDims, composeDims } from '../generator/questions'
import { listCatalog, saveCatalogItem } from '../api/catalog'
import { SIDE_VIEWS, pickSideView } from '../generator/sideviews'
import { resolveSignTypeName } from '../generator/faCatalog'
import { T } from '../generator/catalog'
import { rasterizePdf } from '../generator/pdfRaster'
import { fileUrl } from '../api/client'
import { MAX_PRICE, FLOWS, PART_KEYS, makeCustomTpl, legacyPartFromGd, matchSignType, resolveTplByName, itemSigned } from '../generator/parts'
import { isCloudDoc, cloudRaster, cropToBox, urlToDataUrl } from '../generator/artwork'
import ClientStep from '../components/generator/ClientStep'
import ProjectStep from '../components/generator/ProjectStep'
import SignTypeStep from '../components/generator/SignTypeStep'
import SpecsStep from '../components/generator/SpecsStep'
import ArtworkStep from '../components/generator/ArtworkStep'
import CustomSpecsStep from '../components/generator/CustomSpecsStep'
import PreviewStep from '../components/generator/PreviewStep'
import { computeDimSpec, computeApplicationSpec } from '../generator/specSync'
import { ExitAskModal, DrawingModal } from '../components/generator/WizardModals'
import EditQuoteSpecsModal from '../components/generator/EditQuoteSpecsModal'
import WizardHeader from './generator/components/WizardHeader'
import WizardProgressBar from './generator/components/WizardProgressBar'
import LivePreviewPanel from './generator/components/LivePreviewPanel'
import { useQuoteData } from './generator/hooks/useQuoteData'
import { usePageCapture, normalizeBlankPages } from './generator/hooks/usePageCapture'
import { useLivePreview } from './generator/hooks/useLivePreview'

export default function Generator() {
  const { quoteId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  // return to wherever the quote was opened from (#9), defaulting to All Quotes
  const exitTo = location.state?.from || '/quotes'
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const { data: constants } = useConstants()
  const admin = useSelector(selectIsAdmin)
  const canCreatePaymentLinks = useSelector(selectUser)?.can_create_payment_links || admin
  const reps = constants?.sales_reps || []

  // wizard state — the scratch buffer for the ONE part currently being created or edited
  // (`activePart`, from useQuoteData below). saveProgress() folds these into that part's slot
  // in the persisted `parts` array on every save.
  const [autoAi, setAutoAi] = useState(false)
  const [template, setTemplate] = useState(null)
  const [answers, setAnswers] = useState({})
  const [artworkPath, setArtworkPath] = useState(null)
  const [artErr, setArtErr] = useState('')
  const [cropping, setCropping] = useState(false)   // #5 big-canvas crop editor open?
  const [signBox, setSignBox] = useState(null)      // bounding box of the sign on the artwork (fractions) for precise dim arrows
  const [paymentLink, setPaymentLink] = useState('')
  const [sideViews, setSideViews] = useState([])   // chosen side-view keys
  const [customSpec, setCustomSpec] = useState(null)
  const [logo, setLogoUrl] = useState(null)
  const [signSearch, setSignSearch] = useState('')
  const [signGroup, setSignGroup] = useState(null)   // #5 — selected main category (two-level picker)
  const [exitAsk, setExitAsk] = useState(false)      // #3 — "save or delete?" ask when leaving the proposal
  const [typePicking, setTypePicking] = useState(false)  // #2 — two-level custom-mode type picker open
  const [typeGroup, setTypeGroup] = useState(null)       //      selected main type inside it
  const [customType, setCustomType] = useState('')   // free-typed sign type (not in the catalog)
  const [signLib, setSignLib] = useState([])          // team's saved custom sign types (shared, both modes)
  const [customTypeSel, setCustomTypeSel] = useState('')  // dropdown selection on the custom-specs page
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeSpec, setNewTypeSpec] = useState('')
  const [customDimsStatus, setCustomDimsStatus] = useState('')
  const customDimsTried = useRef(false)
  const [saving, setSaving] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiStatus, setAiStatus] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const artInput = useRef(null)
  const [showDrawing, setShowDrawing] = useState(false)   // in-app viewer for the customer's file
  const [drawingOk, setDrawingOk] = useState(null)        // null = checking, false = file missing on server
  const [proposalNotes, setProposalNotes] = useState('')  // net-new notes (asked last), shown on the proposal
  const [repOther, setRepOther] = useState(false)         // typing a custom sales rep

  // A just-deleted page, kept for a few seconds so it can be undone (deleting a sign page used to be
  // irreversible). { part, index } — undoDeletePage re-inserts it at its original spot.
  const [deletedPage, setDeletedPage] = useState(null)
  const deleteTimer = useRef(null)

  // Loads the quote + multi-page `parts` model once on mount, and hydrates the wizard scratch-
  // buffer state above from the first part (see src/pages/generator/hooks/useQuoteData.js).
  const {
    quote, setQuote, generatedData, setGeneratedData, generatedDataRef,
    parts, setParts, partsRef, activePart, setActivePart,
    mode, step, setStep, loading, loadError,
    client, setClient, special, setSpecial,
  } = useQuoteData(quoteId, searchParams, {
    setTemplate, setAnswers, setAiResult, setCustomSpec, setCustomTypeSel, setArtworkPath, setSignBox,
    setSideViews, setPaymentLink, setProposalNotes, setAutoAi, setLogoUrl,
  })

  // A requirement LIFTED out of the spec text must reach the database immediately. The spec text
  // autosaves, so cutting the line there while special_requirements waited for the rep to press
  // Next left a window in which the text existed in NEITHER place — reopening the quote would
  // show a requirement that had silently vanished. Persist it the moment it is lifted.
  const persistSpecial = async (value) => {
    setSpecial(value)
    if (!quoteId) return
    // Deliberately NOT swallowed: the caller cuts the line out of the spec only if this resolves.
    await updateQuote(quoteId, { special_requirements: value })
  }

  const flow = mode ? FLOWS[mode] : []
  const flowIndex = flow.indexOf(step)

  const { previewKey, livePreviewState } = useLivePreview({
    mode, parts, activePart, answers, client, customSpec, template, sideViews,
    artworkPath, proposalNotes, paymentLink, aiResult,
  })
  const livePreview = !loading && !loadError && step && step !== 'preview'
  const aiSuggestedName = aiResult && aiResult.signType ? (matchSignType(aiResult.signType)?.n || null) : null
  const goto = (s) => setStep(s)
  const next = () => goto(flow[flowIndex + 1])

  // ── ONE STEP, TWO WAYS IN ───────────────────────────────────────────────────────────────────
  // A step reached through the PIPELINE continues down the pipeline. The SAME step opened from the
  // preview's "Edit specs" / "Edit artwork" is a single-purpose errand and must return to the
  // preview it was opened from — the rep asked to change one thing, not to be walked through the
  // rest of the wizard again.
  // `returnTo` records which of the two happened. The alternative — inferring it from the step's
  // absence in `flow` — is what deleted Artwork from the custom pipeline entirely, so a brand-new
  // quote was never asked for artwork. Entry mode is not a property of the flow.
  const [returnTo, setReturnTo] = useState(null)   // 'preview' when opened from a per-page button
  const openFromPreview = (s) => { setReturnTo('preview'); goto(s) }
  const startPipeline = (s) => { setReturnTo(null); goto(s) }

  // A step that is NOT part of the pipeline has no position in `flow`, so flowIndex is -1. Without
  // this it would fall to the "first step" branch and LEAVE THE QUOTE on Back, instead of returning
  // to the preview the editor was opened from.
  const back = () => {
    if (returnTo === 'preview') { setReturnTo(null); return goto('preview') }
    if (flowIndex < 0) return goto('preview')
    return flowIndex > 0 ? goto(flow[flowIndex - 1]) : navigate(exitTo)
  }

  // BLANK PAGES (the client-document sheets) are INDEPENDENT sheets, not a property of a sign.
  // They used to be a `blank_page` flag on the part, which capped a quote at one blank page per
  // sign and welded it to that sign for life: two documents in front of page A was impossible, and
  // moving one behind page B meant re-attaching the file. They are now their own list on
  // generated_data, each with its own id, its own attached document, and one positional fact —
  // `at`, the number of SIGN pages in front of it. Several may share one `at`; array order breaks
  // the tie, which is what ↑/↓ reorders.
  //
  // They still mint nothing that belongs to signs: no letter, no PROPOSAL ID suffix, no share of
  // the total, no entry anywhere `parts` is counted.
  //
  // Legacy quotes (flag on the part) are read forward by normalizeBlankPages on every render, so
  // they keep rendering and keep exporting; the first action below writes the normalized list back.
  const blankPages = useMemo(
    () => normalizeBlankPages(parts, generatedData?.blank_pages),
    [parts, generatedData?.blank_pages],
  )
  const blankPagesRef = useRef(blankPages); blankPagesRef.current = blankPages

  // One writer for the list — every blank-page action funnels through here, so persistence,
  // the ref sync and the cache invalidation cannot drift between them.
  const writeBlankPages = async (nextBlanks) => {
    const payload = { ...(generatedDataRef.current || {}), blank_pages: nextBlanks }
    blankPagesRef.current = nextBlanks
    generatedDataRef.current = payload
    setGeneratedData(payload)
    await putGenerated(quoteId, payload)
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // New blank pages land at the TOP of the document (`at: 0`) — a fixed, predictable landing spot
  // the rep then drags into place with ↑/↓, rather than a guess about which sign it belongs to.
  // There is no cap: a quote can carry as many as the job needs.
  const addBlankPage = () => writeBlankPages([
    ...blankPagesRef.current,
    { __bid: `b${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, client_doc: null, at: 0 },
  ])

  const removeBlankPage = (bid) => writeBlankPages(blankPagesRef.current.filter((b) => b.__bid !== bid))

  const patchBlankPage = (bid, patch) => writeBlankPages(
    blankPagesRef.current.map((b) => (b.__bid === bid ? { ...b, ...patch } : b)),
  )

  // ↑/↓ moves a blank page ONE SHEET at a time through the whole document. Two things can be true
  // of the sheet in front of it: another blank page in the same slot (then they swap in the array,
  // `at` unchanged), or a sign page (then it steps over that sign, `at` ±1). Doing it in that order
  // is what lets a blank travel past every sheet in the document — clamping at 0 and at
  // parts.length, the two ends of the document.
  const moveBlankPage = (bid, dir) => {
    const list = [...blankPagesRef.current]
    const pos = list.findIndex((b) => b.__bid === bid)
    if (pos < 0) return
    const blank = list[pos]
    const at = Number(blank.at) || 0
    const sameSlot = list.filter((b) => Number(b.at) === at)
    const orderInSlot = sameSlot.indexOf(blank)
    const neighbour = sameSlot[orderInSlot + dir]
    if (neighbour) {
      const neighbourPos = list.indexOf(neighbour)
      ;[list[pos], list[neighbourPos]] = [list[neighbourPos], list[pos]]
      return writeBlankPages(list)
    }
    const nextAt = at + dir
    if (nextAt < 0 || nextAt > partsRef.current.length) return
    list[pos] = { ...blank, at: nextAt }
    return writeBlankPages(list)
  }

  const { pageRefs, docRefs, proposalRef, multiPreviewRef, collectPartImages, captureAllPages, capturePagesExport } = usePageCapture(parts, blankPages)

  // Persist the shared payment link (top-level, one per quote) without touching parts or hooks.
  const savePaymentLink = async (url) => {
    setPaymentLink(url)
    const payload = { ...(generatedDataRef.current || {}), payment_link: url }
    generatedDataRef.current = payload
    setGeneratedData(payload)
    await putGenerated(quoteId, payload)
  }
  const [checkpointBusy, setCheckpointBusy] = useState('')
  const [checkpointMessage, setCheckpointMessage] = useState('')

  const saveAndReturn = async () => { await saveProgress(); navigate(exitTo) }   // #4 (top-bar action)

  // Manual checkpoint: flush pending edits, then mint {quote_id}-rev{n} with the rendered proposal
  // image. Same version boundary a payment creates — for saving a version without taking a payment.
  const saveCheckpoint = async () => {
    setCheckpointBusy('1'); setCheckpointMessage('')
    try {
      await saveProgress()   // ensure the latest edits are recorded as changes before the checkpoint
      let checkpointImage = null
      try { checkpointImage = await captureAllPages() } catch { /* image optional */ }   // whole quote (all signs)
      const checkpoint = await createCheckpoint(quoteId, checkpointImage)
      setCheckpointMessage('Saved ' + (checkpoint?.label || 'checkpoint'))
      setTimeout(() => setCheckpointMessage(''), 4000)
    } catch (err) {
      setCheckpointMessage(err?.response?.data?.error || 'Could not save checkpoint.')
    } finally { setCheckpointBusy('') }
  }

  // Snapshot the wizard hooks into the ACTIVE part's shape. proposal_state is owned by the
  // Proposal component (it flows in via `extra`), so we keep the part's existing proposal_state
  // unless a fresh one is supplied. Any part-level key passed in `extra` overrides the hook value.
  const partFromHooks = (prev = {}, extra = {}) => {
    const part = {
      ...prev,
      quote_type: mode,
      tpl_name: template?.n || null,
      tpl_stored_spec: template?.storedSpec || null,
      answers,
      ai: aiResult,
      custom_spec: customSpec,
      artwork_path: (artworkPath && !artworkPath.startsWith('blob:') && !artworkPath.startsWith('data:')) ? artworkPath : null,
      side_views: sideViews,
      sign_box: signBox,
      proposal_notes: proposalNotes,
    }
    for (const key of PART_KEYS) if (extra[key] !== undefined) part[key] = extra[key]
    return part
  }

  // Keys in `extra` that belong to the whole quote, not one part.
  const SHARED_KEYS = ['payment_link', 'job_name']

  const saveProgress = async (extra = {}) => {
    // fold the live wizard hooks (+ any part-level extra) into the active part; leave the rest as-is
    const base = partsRef.current.length ? partsRef.current : [{}]
    const nextParts = base.map((part, index) => (index === activePart ? partFromHooks(part, extra) : part))
    const shared = {}
    for (const key of SHARED_KEYS) if (extra[key] !== undefined) shared[key] = extra[key]

    const payload = {
      ...(generatedDataRef.current || {}),
      quote_type: mode,
      job_name: client.job_name,
      payment_link: paymentLink,
      parts: nextParts,
      // Top-level mirror of the FIRST part — the backend's price fallback and readers that
      // haven't moved to `parts` yet (payment link, quick view) still see a valid single sign.
      // Removed once every reader iterates parts.
      ...legacyPartFromGd(nextParts[0] || {}),
      ...shared,
    }
    partsRef.current = nextParts; generatedDataRef.current = payload   // sync before the async write
    setParts(nextParts)
    setGeneratedData(payload)
    await putGenerated(quoteId, payload)
    // refresh dashboard/list so quote_type + price reflect the saved progress
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // Persist a patch to ONE part (used by the preview, where each page edits itself directly, not
  // through the wizard hooks). Does NOT fold the hooks — only touches parts[i].
  const savePart = async (index, patch) => {
    const nextParts = partsRef.current.map((part, idx) => (idx === index ? { ...part, ...patch } : part))
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts, ...legacyPartFromGd(nextParts[0] || {}) }
    partsRef.current = nextParts; generatedDataRef.current = payload
    setParts(nextParts)
    setGeneratedData(payload)
    await putGenerated(quoteId, payload)
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // One part's dollar total (mirrors the backend partTotal): unit×qty + extra line items.
  const partAmount = (part) => {
    const priceRaw = part?.custom_spec?.price ?? part?.answers?.price
    const price = Number(priceRaw) || 0
    const quantityRaw = parseInt(part?.proposal_state?.__qty ?? part?.custom_spec?.qty ?? part?.answers?.qty ?? 1, 10)
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1
    const extras = (Array.isArray(part?.proposal_state?.__items) ? part.proposal_state.__items : [])
      .reduce((sum, item) => sum + itemSigned(item), 0)
    return Math.max(0, price * quantity + extras)
  }
  const grandTotal = parts.reduce((sum, part) => sum + partAmount(part), 0)

  // Rebuild a part's template object from its saved name (catalog entry, or a synthesized custom one).
  const tplForPart = (part) => (part?.tpl_name ? resolveTplByName(part.tpl_name, part.tpl_stored_spec || null) : null)

  // One sign's title for the combined payment link, WITHOUT the trailing "FOR {company}" (added
  // once at the end so "Signarama" appears a single time — Sami's rule #2).
  const signTitleOf = (part) => {
    const company = client.company_name || ''
    let description = part?.custom_spec?.itemDesc || tplForPart(part)?.desc || 'SIGN'
    if (company) {
      const escapedCompany = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      description = description.replace(new RegExp('\\s*FOR\\s+' + escapedCompany + '\\s*$', 'i'), '')
    }
    return description.trim() || 'SIGN'
  }
  const linkTitle = (() => {
    const company = client.company_name || ''
    return parts.map(signTitleOf).join(' & ') + (company ? ' FOR ' + company : '')
  })()

  // Load a saved part into the wizard hooks (so the wizard / Edit specs edits THAT part).
  const loadPartIntoHooks = (part = {}) => {
    setTemplate(tplForPart(part))
    setAnswers(part.answers || {})
    setAiResult(part.ai || null)
    setCustomSpec(part.custom_spec || null)
    // Restore the sign type alongside the spec. Without it `cat` stays undefined on a reopened
    // quote: the mounting / trim-cap dropdowns vanish, and the side view cannot be re-derived
    // because the app no longer knows which diagram it had chosen itself.
    setCustomTypeSel(resolveSignTypeName(part.custom_spec, T))
    setArtworkPath(part.artwork_path || null)
    setSignBox(part.sign_box || null)
    setSideViews(part.side_views || [])
    setProposalNotes(part.proposal_notes || '')
    // Close the picker UI, but do NOT clear the selection — this line used to blank
    // customTypeSel on every part load, which is why reopening a quote showed
    // "— pick a sign type —" with its mounting/trim-cap dropdowns gone, and why a later
    // sign-type change could not re-derive the side view: with no previous type, the app
    // could not tell its own auto-chosen diagram from one the rep had picked, so it kept it.
    setTypePicking(false); setTypeGroup(null)
  }

  // A blank page's position is a SLOT NUMBER ("after this many signs"), so inserting or deleting a
  // sign moves the slots underneath it. Without this every add/delete/duplicate would silently slide
  // every blank page below it onto the wrong sheet — and a blank sitting at the end (at ===
  // parts.length) would fall out of range entirely and stop rendering.
  //
  //   insertedAt: a sign appeared at this index — blanks at or after it step down one.
  //   deletedAt:  a sign at this index went away — blanks after it step up one.
  //
  // The end of the document stays the end: a blank parked after the last sign is re-pinned to the
  // new last slot rather than being left in front of the page that was just appended.
  const shiftBlanksForSignChange = (list, { insertedAt = null, deletedAt = null }, nextPartCount) => (
    (list || []).map((blank) => {
      let at = Number(blank.at) || 0
      if (insertedAt !== null && at >= insertedAt) at += 1
      if (deletedAt !== null && at > deletedAt) at -= 1
      return { ...blank, at: Math.max(0, Math.min(at, nextPartCount)) }
    })
  )

  // "+ Add page": save the current part, append a fresh blank part, and re-enter the wizard at the
  // sign-type/specs step for it. Company/client are shared, so those steps are skipped.
  const addPage = async () => {
    await saveProgress()   // fold the active part's live hooks in first
    const nextParts = [...partsRef.current, { __pid: `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }]
    const newIndex = nextParts.length - 1
    const nextBlanks = shiftBlanksForSignChange(blankPagesRef.current, { insertedAt: nextParts.length - 1 }, nextParts.length)
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts, blank_pages: nextBlanks }
    partsRef.current = nextParts; generatedDataRef.current = payload; blankPagesRef.current = nextBlanks
    setParts(nextParts)
    setGeneratedData(payload)
    setActivePart(newIndex)
    loadPartIntoHooks({})                       // blank scratch buffer for the new sign
    await putGenerated(quoteId, payload)
    // A second sign is a NEW build, so it walks the whole pipeline — including artwork, which this
    // sign does not have yet.
    startPipeline(mode === 'custom' ? 'customspecs' : 'signtype')
  }

  // "⧉ Duplicate page": copy ONE page whole — specs, artwork, side views, sign box, the saved
  // proposal_state (spec body, line items, discounts, swatches, layout nudges, hidden blocks) — and
  // insert the copy directly after the page it came from. The copy is a normal page from that
  // moment on: every button beside it (Edit specs / Edit artwork / Move / Delete / blank page) acts
  // on the COPY alone, because all of them close over the index of the freshly-mapped render.
  //
  // WHY a deep clone and not `{ ...part }`: proposal_state, answers, side_views and sign_box are
  // nested objects. A shallow copy would leave the two pages sharing them, so editing a line item
  // or nudging a swatch on the copy would silently rewrite the original as well — the #15
  // cross-contamination failure, in a new place.
  //
  // Everything that identifies a page by POSITION is deliberately NOT copied: the letter (A/B/…),
  // the "PROPOSAL ID: …-X" suffix and the last-page total/downloads/payment block are all
  // index-derived, so the copy re-derives them on mount, exactly as movePart relies on.
  // __pid is regenerated for the same reason — pageRefs/docRefs are keyed by it, and two pages
  // sharing one key would make the exporter capture one sheet twice.
  //
  // BLANK PAGES ARE NOT COPIED. They are independent sheets with their own place in the document,
  // not a property of the sign they happen to sit in front of, so duplicating a sign duplicates the
  // SIGN only. A rep who wants a second copy of a client document adds a blank page and attaches it
  // — one click, and it can then sit anywhere, which copying-with-the-sign could never give.
  // Any legacy `client_doc`/`blank_page` still stored on the part is stripped from the copy for the
  // same reason (and so the copy cannot resurrect a sheet the rep already moved away).
  const duplicatePage = async (index) => {
    await saveProgress()   // fold the active page's live hooks in first, or the copy misses them
    const source = partsRef.current[index]
    if (!source) return
    const copy = JSON.parse(JSON.stringify(source))
    copy.__pid = `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    delete copy.client_doc; delete copy.blank_page
    const nextParts = [...partsRef.current]
    nextParts.splice(index + 1, 0, copy)
    const nextBlanks = shiftBlanksForSignChange(blankPagesRef.current, { insertedAt: index + 1 }, nextParts.length)
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts, blank_pages: nextBlanks, ...legacyPartFromGd(nextParts[0] || {}) }
    partsRef.current = nextParts; generatedDataRef.current = payload; blankPagesRef.current = nextBlanks
    setParts(nextParts)
    setGeneratedData(payload)
    // The wizard's scratch buffer follows the page the rep was on. If that page moved down one slot
    // by the insert, the active index moves with it, so a later saveProgress still writes back to
    // the SAME sign and not to the copy sitting in its old slot.
    if (activePart > index) setActivePart(activePart + 1)
    await putGenerated(quoteId, payload)
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // #9 — open the full wizard spec editor (sign type picker, dims, price, spec text) for ONE page:
  // make it the active part, load it into the hooks, and jump to the spec step. Returns STRAIGHT to
  // the preview when done (#12): changing a spec is not a reason to re-walk the artwork step.
  const editPart = (index) => {
    setActivePart(index)
    loadPartIntoHooks(partsRef.current[index] || {})
    openFromPreview(mode === 'custom' ? 'customspecs' : 'signtype')
  }

  // Artwork editor for ONE page. Same shape as editPart — make that part active, load it into the
  // hooks, open its step — which is what scopes it to that page: loadPartIntoHooks restores that
  // part's artwork_path and sign_box, and saveProgress writes back to `activePart`. So on a
  // multi-sign quote each page's button edits its OWN artwork and cannot touch its neighbours'.
  const editArtwork = (index) => {
    setActivePart(index)
    loadPartIntoHooks(partsRef.current[index] || {})
    openFromPreview('artwork')
  }

  // Delete one page (only offered when >1). Letters (A/B/…) are index-derived, so they resync
  // automatically; the active part is clamped and reloaded so the wizard stays coherent.
  const deletePage = async (index) => {
    if (partsRef.current.length <= 1) return
    const removedPart = partsRef.current[index]                       // keep it so the delete can be undone
    const nextParts = partsRef.current.filter((_, idx) => idx !== index)
    const nextBlanks = shiftBlanksForSignChange(blankPagesRef.current, { deletedAt: index }, nextParts.length)
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts, blank_pages: nextBlanks, ...legacyPartFromGd(nextParts[0] || {}) }
    partsRef.current = nextParts; generatedDataRef.current = payload; blankPagesRef.current = nextBlanks
    setParts(nextParts)
    setGeneratedData(payload)
    const newActive = Math.min(activePart, nextParts.length - 1)
    setActivePart(newActive)
    loadPartIntoHooks(nextParts[newActive])
    await putGenerated(quoteId, payload)
    // offer an Undo for a few seconds (a deleted sign page used to be gone for good)
    setDeletedPage({ part: removedPart, index })
    clearTimeout(deleteTimer.current)
    deleteTimer.current = setTimeout(() => setDeletedPage(null), 12000)
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // Undo the last page delete: re-insert the kept part at its original index and persist.
  const undoDeletePage = async () => {
    if (!deletedPage) return
    const { part, index } = deletedPage
    const updatedParts = [...partsRef.current]
    updatedParts.splice(Math.min(index, updatedParts.length), 0, part)
    const nextBlanks = shiftBlanksForSignChange(blankPagesRef.current, { insertedAt: Math.min(index, updatedParts.length - 1) }, updatedParts.length)
    const payload = { ...(generatedDataRef.current || {}), parts: updatedParts, blank_pages: nextBlanks, ...legacyPartFromGd(updatedParts[0] || {}) }
    partsRef.current = updatedParts; generatedDataRef.current = payload; blankPagesRef.current = nextBlanks
    setParts(updatedParts)
    setGeneratedData(payload)
    setActivePart(index)
    loadPartIntoHooks(updatedParts[index])
    setDeletedPage(null)
    clearTimeout(deleteTimer.current)
    await putGenerated(quoteId, payload)
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // Swap a sign page with its neighbour (↑/↓ on the preview step). ONLY the array order moves —
  // every letter-derived thing follows automatically because it's all index-driven: partLetter(i)
  // renames A/B/C…, the pageKey change remounts each moved page so its "PROPOSAL ID: …-X" line
  // is rebuilt for the new letter, and isLast recomputes so the combined subtotal, downloads,
  // Discount and payment-link buttons migrate to whichever page is now last. The active wizard
  // part follows its page to keep edits landing on the same SIGN, not the same slot number.
  const movePart = async (index, dir) => {
    const target = index + dir
    const current = partsRef.current
    if (target < 0 || target >= current.length) return
    const nextParts = [...current]
    ;[nextParts[index], nextParts[target]] = [nextParts[target], nextParts[index]]
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts, ...legacyPartFromGd(nextParts[0] || {}) }
    partsRef.current = nextParts; generatedDataRef.current = payload
    setParts(nextParts)
    setGeneratedData(payload)
    if (activePart === index) setActivePart(target)
    else if (activePart === target) setActivePart(index)
    await putGenerated(quoteId, payload)
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  // EDIT QUOTE SPECS — the identity fields (job, proposal ID, company, client, contact, address)
  // written straight to the quote row, which is what the proposal header, the quotes grid and the
  // dashboard all read. One write, three surfaces; nothing is typed twice.
  //
  // The PROPOSAL ID is this quote's `quote_id`, and `quote_id` is the ROUTE KEY (Quote::
  // getRouteKeyName). Renaming it therefore changes this page's own address, and every later
  // request from this session — autosave, uploads, checkpoints — would 404 against the old one.
  // So the URL is replaced in the same breath as the state. `replace` and not `push`: Back should
  // return to the quotes list the rep came from, not to a URL that no longer resolves.
  const [editSpecs, setEditSpecs] = useState(false)
  const saveQuoteSpecs = async (form) => {
    const renamedTo = form.quote_id && form.quote_id !== quoteId ? form.quote_id : null
    // Errors are NOT swallowed: a duplicate Proposal ID answers 400 and the modal shows the
    // server's own wording. Closing on a failed save would look like it worked.
    const updated = await updateQuote(quoteId, form)
    setQuote(updated)
    // JOB NAME LIVES IN TWO PLACES AND generated_data WINS. useQuoteData hydrates it as
    // `generatedData.job_name || quote.job_name` (the wizard writes its own copy on every save), so
    // updating only the quote row looked right until the next load — the reload after a Proposal ID
    // rename made that "next load" immediate and the new job name vanished on the spot. The other
    // five fields have no second copy and need none of this. Verified live before and after.
    if ((generatedDataRef.current || {}).job_name !== undefined
        || (updated.job_name || '') !== ((generatedDataRef.current || {}).job_name || '')) {
      const payload = { ...(generatedDataRef.current || {}), job_name: updated.job_name || '' }
      generatedDataRef.current = payload
      setGeneratedData(payload)
      // ADDRESSED BY THE NEW ID, not by `quoteId`. The rename has already landed by this line, so
      // the old string no longer resolves and this write 404s — which is precisely what happened
      // the first time: the quote row saved, the mirror did not, and the modal reported a failure
      // for a change that had in fact half-succeeded.
      await putGenerated(updated.quote_id || quoteId, payload)
    }
    setClient((c) => ({
      ...c,
      company_name: updated.company_name || '', client_name: updated.client_name || '',
      contact: updated.contact || '', email: updated.email || '',
      address: updated.address || '', job_name: updated.job_name || '',
    }))
    // The grid and the dashboard are react-query caches, not local state — the same invalidation
    // every other write here uses. Without it the rep sees the new name in the Estimator and the
    // old one on the dashboard until a hard reload, which is exactly the double-entry this feature
    // exists to remove.
    qc.invalidateQueries({ queryKey: ['quotes'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    if (renamedTo) navigate(`/quotes/${renamedTo}/generate`, { replace: true })
  }

  // --- step handlers ---
  const saveClient = async () => {
    await updateQuote(quoteId, client)
    await saveProgress()        // also persists the payment link
    next()
  }
  // Upload + persist a chosen/edited artwork File (shared by the file picker and the crop tool #5).
  const commitArtworkFile = async (file) => {
    if (!file) return
    setArtErr('')
    setArtworkPath(URL.createObjectURL(file))   // show the picked image immediately, straight from the local file
    try {
      const path = await uploadArtwork(quoteId, file)
      setArtworkPath(path)                          // swap to the saved server copy
      // A NEW image must fit fresh: drop the previous artwork crop geometry + sign box, otherwise
      // the old crop window is applied to the new picture and it looks "picked wrong".
      const proposalState = parts[activePart]?.proposal_state
      const cleanedProposalState = proposalState?.__layout?.artwork
        ? { ...proposalState, __layout: (() => { const layout = { ...proposalState.__layout }; delete layout.artwork; return layout })() }
        : proposalState
      setSignBox(null)
      // artwork_auto:false — the rep chose this file; no re-read may ever replace it
      await saveProgress({ artwork_path: path, artwork_auto: false, proposal_state: cleanedProposalState, sign_box: null })
    } catch (err) {
      setArtErr('Shown locally, but the server upload failed: ' + (err.response?.data?.message || err.message || 'unknown error'))
    }
  }
  const onArtwork = (e) => commitArtworkFile(e.target.files[0])
  // Per-part artwork upload used by PreviewStep's per-page ✂ Crop button. Uploads the cropped
  // file, patches ONLY that part's artwork_path (multi-sign quotes have one artwork per page),
  // and drops that part's saved artwork frame so the new image auto-fits fresh.
  const commitPartArtworkFile = async (index, file) => {
    if (!file) return
    const path = await uploadArtwork(quoteId, file)
    const currentPart = partsRef.current[index] || {}
    const proposalState = currentPart.proposal_state
    const cleanedProposalState = proposalState?.__layout?.artwork
      ? { ...proposalState, __layout: (() => { const layout = { ...proposalState.__layout }; delete layout.artwork; return layout })() }
      : proposalState
    await savePart(index, { artwork_path: path, artwork_auto: false, proposal_state: cleanedProposalState })
    if (index === activePart) setArtworkPath(path)
  }
  // The customer's own spec sheet / drawing for ONE sign page (the CLIENT DOCUMENT sheet under it).
  // Stored through the extra-file endpoint on purpose: it must NOT touch `quote.customer_pdf`, which
  // is the quote's primary intake drawing and feeds the AI spec read, the artwork fallback and the
  // View modal's carousel. A per-page attachment overwriting that would rewrite the quote's history.
  const [clientDocBusy, setClientDocBusy] = useState(null)   // blank-page id currently uploading
  const [clientDocErr, setClientDocErr] = useState('')
  // The document belongs to the BLANK PAGE, not to a sign — that is what lets the sheet keep its
  // file while it is moved between sign pages, and what lets two blank pages sit in the same slot
  // carrying different documents.
  const commitPartClientDoc = async (bid, file) => {
    if (!file) return
    setClientDocBusy(bid); setClientDocErr('')
    try {
      const path = await uploadExtraFile(quoteId, file)
      await patchBlankPage(bid, { client_doc: path })
    } catch (err) {
      // The preview step has no artwork-error strip, so this has to surface ON the sheet — a failed
      // upload that only logged would look exactly like a successful one that rendered nothing.
      setClientDocErr(err?.response?.data?.error || err?.message || 'That file could not be uploaded.')
    } finally { setClientDocBusy(null) }
  }

  const onCustomerFile = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const path = await uploadCustomerFile(quoteId, file)
    setQuote((quoteData) => ({ ...quoteData, customer_pdf: path }))
    // if it's an image, flow it straight to the proposal artwork too (#10)
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) setArtworkPath(path)
    // a replaced file means the old reading is stale — re-read automatically with the NEW file
    if (mode === 'generator' && !aiLoading) runAI(path)
  }
  // pdfOverride: pass the just-uploaded path so a replace re-reads the NEW file (state is async)
  const runAI = async (pdfOverride = null) => {
    const drawing = (typeof pdfOverride === 'string' && pdfOverride) || quote?.customer_pdf
    setAiLoading(true)
    setAiStatus('Reading customer details and generating specifications…')
    try {
      await updateQuote(quoteId, { special_requirements: special })
      // vector/CAD PDFs carry no extractable text — render page 1 to an image so vision can read it.
      // (Images and Cloudinary files are read server-side now, straight from their URL.)
      let imageData = null
      let artPath = artworkPath
      if (drawing && (isCloudDoc(drawing) || /\.pdf$/i.test(drawing))) {
        setAiStatus('Rendering the drawing for the AI…')
        let dataUrl = null
        if (isCloudDoc(drawing)) {
          // Cloudinary-stored PDF/AI: let the CDN rasterize page 1 to a PNG (no pdf.js needed)
          try {
            const blob = await (await fetch(cloudRaster(drawing, 1200))).blob()
            dataUrl = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) })
          } catch { dataUrl = null }
        } else {
          dataUrl = await rasterizePdf(fileUrl(drawing))
        }
        if (dataUrl) {
          imageData = dataUrl.split(',')[1]
        }
        setAiStatus('Reading the drawing and generating specifications…')
      }
      const result = await generateSpecs(quoteId, special, SIDE_VIEWS.map((sideView) => sideView.key).join(','), imageData)
      setAiResult(result)
      // Artwork picks itself: the AI locates the sign rendering inside the drawing (artworkBox)
      // and we upload just that crop — full page only as the fallback. Also upgrades the case
      // where the raw document image was used as artwork.
      let pageUrl = (typeof imageData === 'string' && imageData) ? 'data:image/png;base64,' + imageData : null
      if (!pageUrl && drawing && /\.(png|jpe?g|gif|webp)$/i.test(drawing)) {
        try { pageUrl = await urlToDataUrl(fileUrl(drawing)) } catch { pageUrl = null }
      }
      // Re-crop is allowed when there's no artwork yet, when the artwork is just the raw
      // document, or when WE auto-set it on a previous read (artwork_auto) — a re-read must
      // re-pick. Only a rep's own manual upload is never touched.
      let croppedApplied = false
      if (pageUrl && (!artworkPath || artworkPath === drawing || generatedData?.artwork_auto)) {
        try {
          const cropped = await cropToBox(pageUrl, result?.artworkBox)
          const blob = await (await fetch(cropped)).blob()
          const isJpeg = cropped.startsWith('data:image/jpeg')
          const path = await uploadArtwork(quoteId, new File([blob], isJpeg ? 'drawing.jpg' : 'drawing.png', { type: blob.type }))
          artPath = path; setArtworkPath(path); croppedApplied = true
        } catch { if (!artworkPath) setArtworkPath(pageUrl) }
      }
      // snap AI signType to the closest catalog entry (robust match)
      const found = matchSignType(result.signType)
      if (found) setTemplate(found)
      // #7: the retail company is OUR client (company_name); the drawing's "Client:" = end customer (client_name).
      // Fill + persist every party field the AI found, without clobbering anything the user already typed.
      const prefill = {}
      if (result.companyName && !client.company_name) prefill.company_name = result.companyName
      if (result.endCustomer && !client.client_name) prefill.client_name = result.endCustomer
      if (result.contact && !client.contact) prefill.contact = result.contact
      if (result.address && !client.address) prefill.address = result.address
      if (result.jobName && !client.job_name) prefill.job_name = result.jobName
      if (Object.keys(prefill).length) {
        setClient((prevClient) => ({ ...prevClient, ...prefill }))
        updateQuote(quoteId, prefill).catch(() => {})
      }
      // hybrid side-view: deterministic map (by sign type) fused with the Groq-vision suggestion
      const sideViewPick = pickSideView(found?.n || result.signType, result.sideViewKey, result.sideViewConfidence || 0)
      const selectedSideViews = sideViewPick.selected ? [sideViewPick.selected] : []
      if (sideViewPick.selected) setSideViews(selectedSideViews)
      // Persist the AI result NOW, so reopening/edit-back keeps the specs, sign type and side view
      // instead of losing them (the old code saved AI only at a much later step).
      await saveProgress({
        ai: result,
        tpl_name: found?.n || null,
        side_views: selectedSideViews,
        job_name: prefill.job_name || client.job_name || '',
        artwork_path: (artPath && !artPath.startsWith('blob:') && !artPath.startsWith('data:')) ? artPath : null,
        artwork_auto: croppedApplied ? true : (generatedData?.artwork_auto || false),
      })
      setAiStatus('')
    } catch (err) {
      setAiStatus('⚠ AI generation failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setAiLoading(false)
    }
  }

  // Auto-run AI when arriving from Add Quote → AI Mode
  useEffect(() => {
    if (autoAi && step === 'project' && !aiLoading && !aiResult) {
      setAutoAi(false)
      runAI()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAi, step])

  // When the drawing viewer opens, check the file is actually on the server (older uploads can be gone)
  useEffect(() => {
    if (!showDrawing || !quote?.customer_pdf) return
    setDrawingOk(null)
    fetch(fileUrl(quote.customer_pdf), { method: 'HEAD' })
      .then((response) => setDrawingOk(response.ok))
      .catch(() => setDrawingOk(false))
  }, [showDrawing, quote?.customer_pdf])

  // Pick a sign type → go straight to its questions (one click, no separate Next button).
  // Re-picking the SAME type keeps the answers already entered (fixes edit-back wiping specs).
  const pickSign = (nextTemplate) => {
    if (template?.n === nextTemplate.n) { goto('specs'); return }
    setTemplate(nextTemplate)
    setAnswers(aiResult ? autoAnswerFromAI(nextTemplate, aiResult) : {})
    // A different sign type also invalidates the SIDE VIEW that was picked for the old type —
    // re-derive the new type's default construction diagram so the preview matches (bug: the
    // side view kept showing the previous type after switching). Clears it if the new type has
    // no deterministic match; the rep can still override, and QA/AI can refine it afterward.
    const nextPick = pickSideView(nextTemplate.n)
    setSideViews(nextPick.selected ? [nextPick.selected] : [])
    // a different sign type makes any saved spec text wrong — drop it so the proposal
    // rebuilds the SPECIFICATIONS block for the new type (other proposal edits are kept).
    // __pkgSet goes with it: the sheet assigns the PACKAGE INCLUDES letter per sign type, and a
    // saved letter outranks the new type's on mount — so without this the proposal would remount
    // (it is keyed on a debounced previewKey) and restore the OLD type's package artwork.
    setGeneratedData((prevGeneratedData) => {
      const saved = prevGeneratedData?.proposal_state
      if (!saved?.specBody && !saved?.__pkgSet) return prevGeneratedData
      const proposalState = { ...saved }
      delete proposalState.specBody
      delete proposalState.__pkgSet
      proposalState.__dirty = (proposalState.__dirty || []).filter((key) => key !== 'specBody')
      return { ...prevGeneratedData, proposal_state: proposalState }
    })
    goto('specs')
  }

  const finishSpecs = (finalAnswers) => { setAnswers(finalAnswers) }
  const toPreview = async () => {
    setSaving(true)
    try { await updateQuote(quoteId, { special_requirements: special }) } catch { /* non-fatal */ }
    await saveProgress()
    setSaving(false)
    setReturnTo(null)      // the errand is over; the next visit decides its own entry mode
    goto('preview')
  }

  // Save the current step, then advance to the NEXT step in the flow — EXCEPT when this step was
  // opened from the preview by "Edit specs", where the next thing is the preview itself.
  const saveNext = async () => {
    setSaving(true)
    try { await updateQuote(quoteId, { special_requirements: special }) } catch { /* non-fatal */ }
    // the wizard's Quantity is authoritative when you pass THROUGH the wizard — push it into the
    // proposal state too, else a previously saved __qty silently outranks the field forever (#5)
    const wizardQuantity = parseInt(customSpec?.qty, 10)
    await saveProgress(Number.isFinite(wizardQuantity) && wizardQuantity > 0
      ? { proposal_state: { ...(parts[activePart]?.proposal_state || {}), __qty: wizardQuantity } }
      : {})
    setSaving(false)
    if (returnTo === 'preview') { setReturnTo(null); return goto('preview') }
    next()
  }

  // typed custom sign type (AI mode) — use it AND save the name to the team catalog so it
  // shows up in both modes from now on
  const useTypedSignType = () => {
    if (!customType.trim()) return
    const NAME = customType.trim().toUpperCase()
    saveCatalogItem('sign_type', NAME, {}).then((item) => setSignLib((list) => [...list.filter((entry) => entry.name !== NAME), item])).catch(() => {})
    pickSign(makeCustomTpl(NAME))
  }

  // ---- custom (manual) mode helpers ----
  // load the team's saved custom sign types once (shared with AI mode's sign list)
  useEffect(() => { listCatalog('sign_type').then(setSignLib).catch(() => {}) }, [])

  // The spec-text sync transforms live in ../generator/specSync (pure); these thin wrappers
  // keep the setCustomSpec state update in the component.
  const setCustomDim = (dimKey, value) => setCustomSpec((spec) => computeDimSpec(dimKey, value, spec))
  const setCustomApplication = (application) => setCustomSpec((spec) => computeApplicationSpec(application, spec))

  // manual mode still has the customer's drawing — read the dimensions off it automatically
  // (once) when they haven't been entered yet, instead of making the rep squint at the PDF
  useEffect(() => {
    if (step !== 'customspecs' || customDimsTried.current) return
    if (!quote?.customer_pdf || String(customSpec?.dims || '').trim() !== '') return
    customDimsTried.current = true
    ;(async () => {
      try {
        setCustomDimsStatus('⚡ reading the drawing…')
        let imageData = null
        if (isCloudDoc(quote.customer_pdf)) {
          const blob = await (await fetch(cloudRaster(quote.customer_pdf, 1200))).blob()
          const dataUrl = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob) })
          imageData = String(dataUrl).split(',')[1]
        } else if (/\.pdf$/i.test(quote.customer_pdf)) {
          const dataUrl = await rasterizePdf(fileUrl(quote.customer_pdf))
          if (dataUrl) imageData = dataUrl.split(',')[1]
        }
        const result = await generateSpecs(quoteId, special, '', imageData)
        if (result?.dimensions) {
          const parsedDims = parseDims(result.dimensions)
          setCustomSpec((spec) => ({ ...spec, dims: composeDims(parsedDims.l, parsedDims.w, parsedDims.h) }))
          setCustomDimsStatus('⚡ read from the drawing')
        } else {
          setCustomDimsStatus('')
        }
      } catch { setCustomDimsStatus('') }
    })()
  }, [step, quote?.customer_pdf]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="center">Loading…</div>

  if (loadError) return (
    <div className="center" style={{ flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: 0 }}>{loadError === 'notfound' ? "This quote doesn't exist" : "Couldn't load this quote"}</h2>
      <p className="muted" style={{ margin: 0, textAlign: 'center', maxWidth: 420 }}>
        {loadError === 'notfound'
          ? 'The quote may have been deleted, or the link is out of date.'
          : 'Something went wrong reaching the server. Check your connection and try again.'}
      </p>
      <button onClick={() => navigate(exitTo)}>← Back</button>
    </div>
  )

  // mode picker (#55) — DORMANT (#8): AI mode is paused, so we never ask; the loader resolves
  // every quote to a mode (custom by default). Restore this block + the null fallback above to
  // bring the AI generator back.
  // if (!mode) {
  //   return (
  //     <div className="center" style={{ flexDirection: 'column', gap: 16 }}>
  //       <h2>How do you want to build {quoteId}?</h2>
  //       <div style={{ display: 'flex', gap: 16 }}>
  //         <button onClick={() => { setMode('generator'); setStep('project') }}>Quote Generator (AI)</button>
  //         <button className="ghost" onClick={() => { setMode('custom'); setStep('customspecs') }}>Custom Quote Creator</button>
  //       </div>
  //     </div>
  //   )
  // }
  if (!mode) return <div className="center">Loading…</div>

  return (
    <>
      {/* NO top bar anywhere (#5): the wizard controls always sit right above the proposal —
          inside the preview step, and on earlier steps above the live-preview column (or at the
          top of the step card when the live preview is hidden). */}

      {exitAsk && (
        <ExitAskModal admin={admin} saving={saving} saveAndReturn={saveAndReturn}
          quoteId={quoteId} qc={qc} navigate={navigate} onClose={() => setExitAsk(false)} />
      )}
      {/* Seeded from the quote row, not from `client`: `client` is the wizard's scratch buffer and
          holds no quote_id, and the whole point of the form is to show what is SAVED against this
          record. Keyed by quote_id so a rename re-seeds it cleanly if reopened. */}
      {editSpecs && (
        <EditQuoteSpecsModal key={quoteId}
          current={{
            quote_id: quoteId,
            job_name: quote?.job_name || client.job_name || '',
            company_name: quote?.company_name || client.company_name || '',
            client_name: quote?.client_name || client.client_name || '',
            contact: quote?.contact || client.contact || '',
            email: quote?.email || client.email || '',
            address: quote?.address || client.address || '',
          }}
          paymentLink={paymentLink}
          onSave={saveQuoteSpecs}
          onClose={() => setEditSpecs(false)} />
      )}
      {/* The preview step gets the WHOLE viewport for the sheet + its controls: the page title
          ("Custom Quote Creator … — company") and the step progress bar carry no information the
          rep needs while polishing the proposal, and their ~90px came straight out of the page. */}
      {step !== 'preview' && (
        <>
          <WizardHeader mode={mode} quoteId={quoteId} company={quote?.company_name}
            customerPdf={quote?.customer_pdf} onViewDrawing={() => setShowDrawing(true)}
            onEditSpecs={() => setEditSpecs(true)} />
          {/* An off-pipeline step (the per-page artwork editor) has no index; show the bar full
              rather than blank, since it is opened FROM the finished preview. */}
          <WizardProgressBar flow={flow} currentIndex={flowIndex < 0 ? flow.length - 1 : flowIndex} />
        </>
      )}

      <div className={'wizard' + (livePreview && step !== 'preview' ? ' wiz-cols' : '')} style={step === 'preview' ? { maxWidth: 'min(1180px, 96%)', marginTop: 0 } : livePreview ? { maxWidth: 'min(1500px, 97%)' } : undefined}>
       <div className="wiz-main">
        {step === 'client' && (
          <ClientStep client={client} setClient={setClient} admin={admin} reps={reps}
            repOther={repOther} setRepOther={setRepOther} saveClient={saveClient} />
        )}

        {step === 'project' && (
          <ProjectStep aiLoading={aiLoading} quote={quote} setShowDrawing={setShowDrawing}
            onCustomerFile={onCustomerFile} ai={aiResult} runAI={runAI} aiStatus={aiStatus} goto={goto} />
        )}

        {step === 'signtype' && (
          <SignTypeStep signSearch={signSearch} setSignSearch={setSignSearch} signGroup={signGroup}
            setSignGroup={setSignGroup} tpl={template} pickSign={pickSign} signLib={signLib}
            aiSuggestedName={aiSuggestedName} customType={customType} setCustomType={setCustomType}
            onUseTypedSignType={useTypedSignType} />
        )}

        {step === 'specs' && template && (
          <SpecsStep tpl={template} ai={aiResult} answers={answers} finishSpecs={finishSpecs} next={next} />
        )}

        {step === 'artwork' && (
          <ArtworkStep cropping={cropping} setCropping={setCropping} artworkPath={artworkPath}
            setArtworkPath={setArtworkPath} saving={saving} signBox={signBox} setSignBox={setSignBox}
            commitArtworkFile={commitArtworkFile} saveProgress={saveProgress} artInput={artInput}
            onArtwork={onArtwork} artErr={artErr} setArtErr={setArtErr} proposalNotes={proposalNotes}
            setProposalNotes={setProposalNotes} toPreview={toPreview} />
        )}

        {step === 'customspecs' && (
          <CustomSpecsStep customSpec={customSpec} setCustomSpec={setCustomSpec}
            customTypeSel={customTypeSel} setCustomTypeSel={setCustomTypeSel} typePicking={typePicking}
            setTypePicking={setTypePicking} typeGroup={typeGroup} setTypeGroup={setTypeGroup}
            signLib={signLib} setSignLib={setSignLib}
            sideViews={sideViews} setSideViews={setSideViews} client={client} newTypeName={newTypeName}
            setNewTypeName={setNewTypeName} newTypeSpec={newTypeSpec} setNewTypeSpec={setNewTypeSpec}
            customDimsStatus={customDimsStatus} setCustomDim={setCustomDim}
            setCustomApplication={setCustomApplication} special={special} setSpecial={setSpecial}
            onSpecialLifted={persistSpecial} ready={!loading}
            saveNext={saveNext} saving={saving} />
        )}

        {step === 'preview' && (
          <PreviewStep parts={parts} cpBusy={checkpointBusy} cpMsg={checkpointMessage} saving={saving}
            saveCheckpoint={saveCheckpoint} navigate={navigate} exitTo={exitTo} addPage={addPage}
            setExitAsk={setExitAsk} deletedPage={deletedPage} undoDeletePage={undoDeletePage}
            deleteTimer={deleteTimer} setDeletedPage={setDeletedPage} multiPreviewRef={multiPreviewRef}
            grandTotal={grandTotal} tplForPart={tplForPart} client={client} quoteId={quoteId}
            collectPartImages={collectPartImages} linkTitle={linkTitle} captureAllPages={captureAllPages}
            capturePagesExport={capturePagesExport} canCreatePaymentLinks={canCreatePaymentLinks}
            savePaymentLink={savePaymentLink} logo={logo} paymentLink={paymentLink} quote={quote}
            savePart={savePart} commitPartArtworkFile={commitPartArtworkFile} movePart={movePart}
            specialRequirements={special}
            commitPartClientDoc={commitPartClientDoc} docBusy={clientDocBusy} docErr={clientDocErr}
            pageRefs={pageRefs} docRefs={docRefs} proposalRef={proposalRef} mode={mode}
            blankPages={blankPages} addBlankPage={addBlankPage} removeBlankPage={removeBlankPage}
            moveBlankPage={moveBlankPage} patchBlankPage={patchBlankPage}
            editPart={editPart} editArtwork={editArtwork} deletePage={deletePage} duplicatePage={duplicatePage}
            onEditSpecs={() => setEditSpecs(true)} />
        )}
       </div>

       {/* LIVE PREVIEW — the real proposal rendered beside every WIZARD step (not the final
           preview step, which already shows the full proposal — a second one there was the
           "extra canvas" gap #1). Editable; remounted via a debounced key so typing survives. */}
       {livePreview && step !== 'preview' && (
         <LivePreviewPanel
           previewKey={previewKey}
           onBack={back}
           onSaveAndReturn={saveAndReturn}
           saving={saving}
           mode={mode}
           template={template}
           answers={answers}
           customSpec={customSpec}
           info={{ company: client.company_name, client: client.client_name, contact: client.contact, email: client.email, address: client.address, job: client.job_name, quoteId }}
           artworkPath={artworkPath}
           onArtworkFile={commitArtworkFile}
           logo={logo}
           aiResult={aiResult}
           paymentLink={paymentLink}
           approval={{ locked: quote?.approval_locked, approved: quote?.price_approved }}
           proposalNotes={proposalNotes}
           specialRequirements={special}
           savedState={livePreviewState()}
           sideViews={sideViews}
           signBox={signBox}
           onSideViews={setSideViews}
           onSave={(proposalState) => saveProgress({ proposal_state: proposalState, side_views: sideViews })}
         />
       )}
      </div>

      {showDrawing && quote?.customer_pdf && (
        <DrawingModal quote={quote} drawingOk={drawingOk} onClose={() => setShowDrawing(false)} />
      )}
    </>
  )
}
