import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConstants, useCreateQuote } from '../hooks'
import { extractParty, putGenerated, uploadExtraFile } from '../api/quotes'
import { rasterizePdf } from '../generator/pdfRaster'
import { useSelector } from 'react-redux'
import { selectUser, selectIsAdmin } from '../store/authSlice'
import client from '../api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { EMPTY, quoteSchema } from './quotes/add/quoteSchema'
import PartyFields, { RepField } from './quotes/add/PartyFields'
import AiIntake from './quotes/add/AiIntake'

// Turn a data URL (rasterized PDF page) into a File so the vision model can read it.
function dataURLtoFile(dataUrl, name) {
  const [head, b64] = dataUrl.split(',')
  const mime = (head.match(/:(.*?);/) || [, 'image/png'])[1]
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new File([arr], name, { type: mime })
}

export default function AddQuoteModal({ onClose }) {
  const navigate = useNavigate()
  const { data: constants } = useConstants()
  const create = useCreateQuote()
  const user = useSelector(selectUser)
  const isAdmin = useSelector(selectIsAdmin)

  // AI mode is paused (#8): open straight into Custom and skip the "AI vs Custom" chooser.
  // Set back to useState(null) to bring the chooser (and AI mode) back.
  const [choice, setChoice] = useState('custom') // null | 'custom' | 'ai'
  const [source, setSource] = useState('file')   // ai: 'file' | 'text' (inline toggle, same page)
  const [files, setFiles] = useState([])         // one or more uploaded files
  const [serverError, setServerError] = useState('')
  const [autofilling, setAutofilling] = useState(false)
  const [revealed, setRevealed] = useState(false) // party fields show only after AI reads
  const [repOther, setRepOther] = useState(false)  // typing a custom sales rep

  const {
    register, handleSubmit, control, reset, watch, getValues, setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(quoteSchema), defaultValues: EMPTY })
  const salesRep = watch('sales_rep')
  const specText = watch('special_requirements')

  // Company autofill (#8/#9): known companies suggest as you type. When you land on an exact
  // known company we bring back its address; contacts come only from the picker below. A field
  // you've hand-edited is never overwritten.
  const [companyHits, setCompanyHits] = useState([])
  const [exactHit, setExactHit] = useState(null)   // the matched company (with .contacts) for the picker
  const autoFilled = useRef({ address: '', client_name: '', contact: '', email: '' })
  // apply a saved contact into any field the user hasn't manually changed
  const applyAuto = (patch) => {
    // Snapshot the previous auto-values BEFORE mutating the ref — comparing a field against the
    // NEW patch made every field look "manually edited" and picking a second company did nothing.
    const prevAuto = { ...autoFilled.current }
    autoFilled.current = { ...autoFilled.current, ...patch }
    for (const k of Object.keys(patch)) {
      const cur = getValues(k)
      const wasAuto = !cur || cur === prevAuto[k]
      if (wasAuto) setValue(k, patch[k] || '')
    }
  }
  const onCompanyChange = async (name) => {
    if (name.trim().length < 2) { setCompanyHits([]); setExactHit(null); return }
    try {
      const { data } = await client.get('/companies/suggest', { params: { q: name } })
      setCompanyHits(data || [])
      // Compare on NORMALISED names. Real company rows carry double spaces and non-breaking
      // spaces ("Signarama  Redmond", " Valley Sign Solutions"), which look identical on
      // screen but never equal what a rep types — so the company read as unknown and its saved
      // address was never filled in. Whitespace is not identity.
      const norm = (s) => String(s || '').replace(/[\s ]+/g, ' ').trim().toLowerCase()
      const typed = norm(name)
      const hit = (data || []).find((c) => norm(c.name) === typed)
      setExactHit(hit || null)
      if (hit) {
        // Dropdown-ONLY autofill (#3, Sami 2026-07-14): a known company fills its ADDRESS, but
        // contact details are never auto-applied — the rep picks the exact contact from the
        // dropdown below (the data still carries duplicates/mislabeled rows; auto-applying the
        // first one kept picking wrong people).
        applyAuto({ address: hit.address || '' })
        // pre-pick the rep who handled this company's latest quote (#5) — only when untouched
        if (hit.last_sales_rep && !getValues('sales_rep')) setValue('sales_rep', hit.last_sales_rep)
      }
    } catch { /* suggestions are best-effort */ }
  }
  // pick a specific saved contact from the dropdown
  const applyContact = (c) => applyAuto({ client_name: c.client_name || '', contact: c.contact || '', email: c.email || '' })

  // Merge only into blank fields, so reading a second file (or a re-read) never wipes what's there.
  const mergeParty = (d) => {
    for (const k of ['company_name', 'client_name', 'contact', 'email', 'address', 'job_name']) {
      if (!getValues(k)) setValue(k, d[k] || '')
    }
  }

  // Read EVERY uploaded file for the party fields. PDFs are rendered to an image first so the
  // vision model can read the sign company's LOGO (where the company name usually lives).
  const autofillFromFiles = async (fs) => {
    if (!fs.length) return
    setAutofilling(true); setServerError('')
    try {
      for (const f of fs) {
        let toRead = f
        const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        if (isPdf) {
          const url = URL.createObjectURL(f)
          const dataUrl = await rasterizePdf(url)
          URL.revokeObjectURL(url)
          if (dataUrl) toRead = dataURLtoFile(dataUrl, 'page.png')
        }
        try { mergeParty(await extractParty(toRead)) } catch { /* keep going with the rest */ }
      }
    } finally {
      setAutofilling(false); setRevealed(true)
    }
  }

  const autofillFromText = async () => {
    const t = (specText || '').trim()
    if (!t) return
    setAutofilling(true); setServerError('')
    try {
      mergeParty(await extractParty(t))
    } catch (err) {
      setServerError('Auto-fill failed: ' + (err.response?.data?.error || err.message || 'unknown error'))
    } finally {
      setAutofilling(false); setRevealed(true)
    }
  }

  const onSubmit = async (form) => {
    setServerError('')
    const payload = { ...form }
    // If this is a KNOWN company and the address you typed differs from the one on file,
    // offer to update the company's saved details (#5) — otherwise the old address stays.
    const known = companyHits.find((c) => c.name.toLowerCase() === form.company_name.trim().toLowerCase())
    const newAddr = form.address.trim()
    if (known && newAddr && newAddr !== (known.address || '').trim()) {
      const msg = known.address
        ? `You entered a different address for "${form.company_name}".\n\nOn file:  ${known.address}\nEntered:  ${newAddr}\n\nUpdate this company's saved address?`
        : `"${form.company_name}" has no saved address yet.\n\nSave "${newAddr}" as this company's address?`
      if (window.confirm(msg)) payload.update_company_address = true
    }
    if (files[0]) payload.customer_pdf = files[0]   // first file is the primary drawing
    try {
      const created = await create.mutateAsync(payload)
      // Keep the extra uploaded files in generated_data (nothing is lost).
      const extras = files.slice(1)
      const gd = {}
      if (extras.length) {
        const paths = []
        for (const f of extras) { try { paths.push(await uploadExtraFile(created.quote_id, f)) } catch { /* skip a bad one */ } }
        if (paths.length) gd.extra_uploads = paths
      }
      if (Object.keys(gd).length) { try { await putGenerated(created.quote_id, gd) } catch { /* non-fatal */ } }
      navigate(`/quotes/${created.quote_id}/generate?mode=${choice}`, { state: { from: '/quotes' } })
    } catch (err) {
      const errs = err.response?.data?.errors
      setServerError(errs ? Object.values(errs)[0][0] : (err.response?.data?.error || err.response?.data?.message || 'Failed to create quote'))
    }
  }

  const reps = constants?.sales_reps || []
  const sources = constants?.quote_sources || []
  const firstError = Object.values(errors)[0]?.message || serverError

  const back = () => { setChoice(null); setRevealed(false); setFiles([]); reset(EMPTY) }

  const partyFields = (
    <PartyFields control={control} register={register} setValue={setValue} choice={choice}
      companyHits={companyHits} exactHit={exactHit}
      onCompanyChange={onCompanyChange} onPickContact={applyContact} sources={sources} />
  )
  const repField = (
    <RepField control={control} register={register} isAdmin={isAdmin} reps={reps} user={user}
      repOther={repOther} setRepOther={setRepOther} setValue={setValue} salesRep={salesRep} />
  )

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(false) }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        {/* ---- Step 1: AI vs Custom ---- */}
        {!choice && (
          <>
            <DialogHeader><DialogTitle>New Quote — how do you want to start?</DialogTitle></DialogHeader>
            <div className="choice-row">
              <div className="choice-tile" onClick={() => setChoice('ai')}>
                <div className="ico">⚡</div>
                <h3>AI Mode</h3>
                <p>Give us the customer's drawing or brief. AI reads it and fills in the company, client and specs.</p>
              </div>
              <div className="choice-tile" onClick={() => setChoice('custom')}>
                <div className="ico">✍️</div>
                <h3>Custom</h3>
                <p>Write the specification yourself — straight to the custom questions, no AI.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            </div>
          </>
        )}

        {/* ---- AI Mode: one page. Inline File/Text toggle, details fill in below after AI reads. ---- */}
        {choice === 'ai' && (
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader className="mb-3"><DialogTitle>⚡ New Quote — AI Mode</DialogTitle></DialogHeader>
            <p className="muted mb-3">Give us the sign as file(s) or text — AI reads it and fills the details below.</p>

            <AiIntake source={source} setSource={setSource} files={files}
              onFilesChange={(fs) => { setFiles(fs); if (fs.length) autofillFromFiles(fs) }}
              specText={specText || ''} onSpecTextChange={(v) => setValue('special_requirements', v)}
              revealed={revealed} autofilling={autofilling} onReadText={autofillFromText} />

            {revealed && (
              <>
                {partyFields}
                <Button type="button" variant="outline" size="sm" disabled={autofilling} className="mb-3.5"
                  onClick={() => (source === 'file' ? files.length && autofillFromFiles(files) : autofillFromText())}>
                  {autofilling ? 'Reading…' : '↻ Re-read'}
                </Button>
              </>
            )}

            {repField}

            {firstError && <p className="err">{firstError}</p>}

            <div className="mt-5 flex justify-end gap-2.5">
              <Button type="button" variant="outline" onClick={back}>← Back</Button>
              <Button type="submit" disabled={create.isPending || !revealed}>
                {create.isPending ? 'Creating…' : 'Create & Run AI →'}
              </Button>
            </div>
          </form>
        )}

        {/* ---- Custom mode ---- */}
        {choice === 'custom' && (
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader className="mb-3"><DialogTitle>New Quote</DialogTitle></DialogHeader>
            {partyFields}
            {repField}
            {/* Artwork is NOT asked here anymore (#5) — it's collected once, on the Artwork step near
                the end of the wizard. Special requirements live on the Custom Specifications page. */}

            {firstError && <p className="err">{firstError}</p>}

            <div className="mt-5 flex justify-end gap-2.5">
              <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create & Continue →'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
