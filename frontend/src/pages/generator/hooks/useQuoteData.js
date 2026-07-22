import { useEffect, useRef, useState } from 'react'
import { getQuote, putGenerated } from '../../../api/quotes'
import { getLogo } from '../../../api/meta'
import { legacyPartFromGd, resolveTplByName } from '../../../generator/parts'

// Loads the quote once on mount and hydrates every piece of wizard state from it: the quote
// record itself, the multi-page `parts` model, and the FIRST part's fields into the wizard's
// scratch-buffer hooks (template/answers/aiResult/customSpec/artworkPath/... — passed in via
// `wizardSetters` since that state lives in Generator, not here).
//
// Owns: quote, generatedData (+ ref), parts (+ ref), activePart, mode, step, client, special,
// loading, loadError. `partsRef`/`generatedDataRef` are read synchronously by the save paths
// elsewhere in Generator (see the comment at their declaration) — each Proposal page autosaves
// independently, so two parts can save within one render; reading state from a stale closure
// would drop one.
export function useQuoteData(quoteId, searchParams, wizardSetters) {
  const {
    setTemplate, setAnswers, setAiResult, setCustomSpec, setArtworkPath, setSignBox,
    setSideViews, setPaymentLink, setProposalNotes, setAutoAi, setLogoUrl,
  } = wizardSetters

  const [quote, setQuote] = useState(null)
  const [generatedData, setGeneratedData] = useState(null)   // existing generated_data
  const [parts, setParts] = useState([])
  const [activePart, setActivePart] = useState(0)
  const partsRef = useRef(parts); partsRef.current = parts
  const generatedDataRef = useRef(generatedData); generatedDataRef.current = generatedData
  const [mode, setMode] = useState(null)        // 'generator' | 'custom'
  const [step, setStep] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')   // set when the quote can't be loaded (e.g. bad/deleted id)
  const [client, setClient] = useState({ company_name: '', client_name: '', contact: '', email: '', address: '', job_name: '', sales_rep: '' })
  const [special, setSpecial] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const loadedQuote = await getQuote(quoteId)
        setQuote(loadedQuote)
        const loadedGeneratedData = loadedQuote.generated_data || {}
        setGeneratedData(loadedGeneratedData)
        setClient({
          company_name: loadedQuote.company_name || '', client_name: loadedQuote.client_name || '',
          contact: loadedQuote.contact || '', email: loadedQuote.email || '', address: loadedQuote.address || '',
          job_name: loadedGeneratedData.job_name || loadedQuote.job_name || '', sales_rep: loadedQuote.sales_rep || '',
        })
        setSpecial(loadedQuote.special_requirements || '')

        // Build the parts list: use loadedGeneratedData.parts when present, else lazy-wrap the legacy
        // top-level bundle as the single part[0]. The wizard opens on the FIRST part; Add Page appends
        // more later.
        const seenPartIds = new Set()
        const loadedParts = ((Array.isArray(loadedGeneratedData.parts) && loadedGeneratedData.parts.length)
          ? loadedGeneratedData.parts
          : [legacyPartFromGd(loadedGeneratedData)])
          // stable id per part → the preview keys pages by it AND the download/link collectors map
          // pageRefs by it. It MUST be unique: a missing OR duplicate id (older data, a copied part)
          // would make two pages share one ref, so every page captured the LAST one repeatedly
          // (the "both pages are B" bug). Regenerate on miss OR collision.
          .map((part, index) => {
            let partId = part.__pid
            if (!partId || seenPartIds.has(partId)) partId = `p${index}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`
            seenPartIds.add(partId)
            return { ...part, __pid: partId }
          })
        setParts(loadedParts)
        // persist the repaired ids so the fix sticks (only when something actually changed)
        if (loadedParts.some((part, index) => part.__pid !== (loadedGeneratedData.parts?.[index]?.__pid))) {
          putGenerated(quoteId, { ...loadedGeneratedData, parts: loadedParts }).catch(() => { })
        }
        setActivePart(0)
        const firstPart = loadedParts[0] || {}

        if (firstPart.tpl_name) setTemplate(resolveTplByName(firstPart.tpl_name, firstPart.tpl_stored_spec || null))
        setAnswers(firstPart.answers || {})
        setAiResult(firstPart.ai || null)
        setCustomSpec(firstPart.custom_spec || null)
        if (firstPart.artwork_path) setArtworkPath(firstPart.artwork_path)
        if (firstPart.sign_box) setSignBox(firstPart.sign_box)
        // #10: if no artwork chosen yet but the customer uploaded an image of the sign, use it
        else if (loadedQuote.customer_pdf && /\.(png|jpe?g|gif|webp|svg)$/i.test(loadedQuote.customer_pdf)) setArtworkPath(loadedQuote.customer_pdf)
        if (firstPart.side_views) setSideViews(firstPart.side_views)
        if (loadedGeneratedData.payment_link) setPaymentLink(loadedGeneratedData.payment_link)   // payment link is shared (one link per quote)
        setProposalNotes(firstPart.proposal_notes || '')
        getLogo().then((l) => setLogoUrl(l.logo)).catch(() => { })

        // Mode comes from the intake choice (?mode=ai|custom) or the persisted quote_type — never re-asked.
        // AI mode is DORMANT for now (#8): anything without an explicit generator mode defaults to
        // CUSTOM, so the AI path is bypassed. Existing AI quotes (quote_type='generator') still open
        // in AI mode, so no data breaks — re-enable by restoring the mode picker below.
        const modeParam = searchParams.get('mode')
        const resolvedMode = loadedGeneratedData.quote_type || firstPart.quote_type
          || (modeParam === 'ai' ? 'generator' : 'custom')
        if (resolvedMode) {
          setMode(resolvedMode)
          if (resolvedMode === 'custom') {
            setStep(firstPart.custom_spec ? 'preview' : 'customspecs')   // straight to the questions
          } else {
            const hasProgress = firstPart.tpl_name && Object.keys(firstPart.answers || {}).length
            setStep(hasProgress ? 'preview' : 'project')
            if (modeParam === 'ai' && !firstPart.ai) setAutoAi(true)      // auto-run extraction once
          }
        }
      } catch (err) {
        // bad / deleted quote id, or the API is down — show a real message instead of spinning forever
        setLoadError(err?.response?.status === 404 ? 'notfound' : 'error')
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId])

  return {
    quote, setQuote, generatedData, setGeneratedData, generatedDataRef,
    parts, setParts, partsRef, activePart, setActivePart,
    mode, setMode, step, setStep, loading, loadError,
    client, setClient, special, setSpecial,
  }
}
