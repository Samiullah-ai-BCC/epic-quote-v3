import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { updateQuote, putGenerated, uploadArtwork, uploadCustomerFile, generateSpecs, createCheckpoint } from '../api/quotes'
import { useConstants } from '../hooks'
import { useSelector } from 'react-redux'
import { selectUser, selectIsAdmin } from '../store/authSlice'
import { autoAnswerFromAI, parseDims, composeDims } from '../generator/questions'
import { listCatalog, saveCatalogItem } from '../api/catalog'
import { SIDE_VIEWS, pickSideView } from '../generator/sideviews'
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
import WizardHeader from './generator/components/WizardHeader'
import WizardProgressBar from './generator/components/WizardProgressBar'
import LivePreviewPanel from './generator/components/LivePreviewPanel'
import { useQuoteData } from './generator/hooks/useQuoteData'
import { usePageCapture } from './generator/hooks/usePageCapture'
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
    setTemplate, setAnswers, setAiResult, setCustomSpec, setArtworkPath, setSignBox,
    setSideViews, setPaymentLink, setProposalNotes, setAutoAi, setLogoUrl,
  })

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
  const back = () => (flowIndex > 0 ? goto(flow[flowIndex - 1]) : navigate(exitTo))

  const { pageRefs, proposalRef, multiPreviewRef, collectPartImages, captureAllPages, capturePagesExport } = usePageCapture(parts)

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
    setArtworkPath(part.artwork_path || null)
    setSignBox(part.sign_box || null)
    setSideViews(part.side_views || [])
    setProposalNotes(part.proposal_notes || '')
    setCustomTypeSel(''); setTypePicking(false); setTypeGroup(null)
  }

  // "+ Add page": save the current part, append a fresh blank part, and re-enter the wizard at the
  // sign-type/specs step for it. Company/client are shared, so those steps are skipped.
  const addPage = async () => {
    await saveProgress()   // fold the active part's live hooks in first
    const nextParts = [...partsRef.current, { __pid: `p${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }]
    const newIndex = nextParts.length - 1
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts }
    partsRef.current = nextParts; generatedDataRef.current = payload
    setParts(nextParts)
    setGeneratedData(payload)
    setActivePart(newIndex)
    loadPartIntoHooks({})                       // blank scratch buffer for the new sign
    await putGenerated(quoteId, payload)
    setStep(mode === 'custom' ? 'customspecs' : 'signtype')
  }

  // #9 — open the full wizard spec editor (sign type picker, dims, price, spec text) for ONE page:
  // make it the active part, load it into the hooks, and jump to the spec step.
  const editPart = (index) => {
    setActivePart(index)
    loadPartIntoHooks(partsRef.current[index] || {})
    setStep(mode === 'custom' ? 'customspecs' : 'signtype')
  }

  // Delete one page (only offered when >1). Letters (A/B/…) are index-derived, so they resync
  // automatically; the active part is clamped and reloaded so the wizard stays coherent.
  const deletePage = async (index) => {
    if (partsRef.current.length <= 1) return
    const removedPart = partsRef.current[index]                       // keep it so the delete can be undone
    const nextParts = partsRef.current.filter((_, idx) => idx !== index)
    const payload = { ...(generatedDataRef.current || {}), parts: nextParts, ...legacyPartFromGd(nextParts[0] || {}) }
    partsRef.current = nextParts; generatedDataRef.current = payload
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
    const payload = { ...(generatedDataRef.current || {}), parts: updatedParts, ...legacyPartFromGd(updatedParts[0] || {}) }
    partsRef.current = updatedParts; generatedDataRef.current = payload
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
    // a different sign type makes any saved spec text wrong — drop it so the proposal
    // rebuilds the SPECIFICATIONS block for the new type (other proposal edits are kept)
    setGeneratedData((prevGeneratedData) => {
      if (!prevGeneratedData?.proposal_state?.specBody) return prevGeneratedData
      const proposalState = { ...prevGeneratedData.proposal_state }
      delete proposalState.specBody
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
    goto('preview')
  }

  // save the current step, then advance to the NEXT step in the flow (not straight to preview)
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
      <WizardHeader mode={mode} quoteId={quoteId} company={quote?.company_name}
        customerPdf={quote?.customer_pdf} onViewDrawing={() => setShowDrawing(true)} />

      <WizardProgressBar flow={flow} currentIndex={flowIndex} />

      <div className={'wizard' + (livePreview && step !== 'preview' ? ' wiz-cols' : '')} style={step === 'preview' ? { maxWidth: 'min(1180px, 96%)' } : livePreview ? { maxWidth: 'min(1500px, 97%)' } : undefined}>
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
            savePart={savePart} commitPartArtworkFile={commitPartArtworkFile}
            pageRefs={pageRefs} proposalRef={proposalRef} mode={mode}
            editPart={editPart} deletePage={deletePage} />
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
