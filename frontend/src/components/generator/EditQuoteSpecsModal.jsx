// EDIT QUOTE SPECS — the quote's identity fields, editable from inside the Estimator.
//
// These five values were previously fixed at intake: to correct a typo'd company name or job name
// the rep had to leave the quote, edit the row in the grid, and come back. Everything here writes
// to the QUOTE ROW (PUT /api/quotes/{id}), which is the single source of truth the proposal, the
// grid and the dashboard all read — so there is exactly one place to type it and nothing to keep
// in sync by hand.
//
// COMPANY NAME IS THE QUOTE'S COPY, NOT THE COMPANY RECORD. `quotes.company_name` is a snapshot
// taken at intake; the `companies` row is a separate thing that other quotes share. Editing here
// must never rename the company for everyone else, so this form only ever PUTs the quote — the
// company_id link is left exactly as it was. (COMPANY AUTOFILL node, SYSTEM_MAP.md)
import { useEffect, useMemo, useRef, useState } from 'react'

// The server's own rule, mirrored so the rep is told before the round-trip rather than by a 400.
// Mirror, not the gate: QuoteController::update re-checks the pattern, the length AND uniqueness,
// which is the only check that can be trusted (another rep may take the ID between keystroke and
// save). See PRICE APPROVAL in SYSTEM_MAP.md for why mirrors never replace the server rule.
const ID_RE = /^[A-Za-z0-9_-]+$/

const FIELDS = [
  { k: 'job_name', label: 'Job Name' },
  { k: 'quote_id', label: 'Proposal ID' },
  { k: 'company_name', label: 'Company Name' },
  { k: 'client_name', label: 'Client Name' },
  // EMAIL is here even though it was not on the asked-for list, because without it the Contact
  // field is a lie. The proposal's CONTACT line is `email || contact` — email first, phone only as
  // the fallback (#7) — so on a quote that has an email (most of them), editing Contact changes the
  // record and nothing on the sheet moves. Showing both is the only version where what the rep
  // types is what the customer reads.
  { k: 'contact', label: 'Contact (phone)' },
  { k: 'email', label: 'Email' },
  { k: 'address', label: 'Address' },
]

export default function EditQuoteSpecsModal({ current, paymentLink, onSave, onClose }) {
  // Seeded ONCE from the record. Re-seeding on every `current` change would fight the rep's typing:
  // saving the quote elsewhere (autosave on another step) re-creates the object identity and would
  // reset a half-typed field under their cursor.
  const [form, setForm] = useState(() => ({
    job_name: current.job_name || '',
    quote_id: current.quote_id || '',
    company_name: current.company_name || '',
    client_name: current.client_name || '',
    contact: current.contact || '',
    email: current.email || '',
    address: current.address || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  const idChanged = form.quote_id.trim() !== (current.quote_id || '')
  const idError = useMemo(() => {
    const v = form.quote_id.trim()
    if (!v) return 'Proposal ID is required'
    if (!ID_RE.test(v)) return 'Only letters, numbers, hyphens and underscores'
    if (v.length > 20) return 'Maximum 20 characters'
    return ''
  }, [form.quote_id])

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    if (idError) { setError(idError); return }
    setSaving(true); setError('')
    try {
      await onSave({
        job_name: form.job_name.trim(),
        quote_id: form.quote_id.trim(),
        company_name: form.company_name.trim(),
        client_name: form.client_name.trim(),
        contact: form.contact.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      })
      onClose()
    } catch (err) {
      // The duplicate-ID answer arrives here ("Quote ID \"EC100004\" already exists"). Showing the
      // server's own words beats a generic failure: it names the ID that clashed.
      setError(err?.response?.data?.error || err?.message || 'Could not save those changes.')
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <form className="modal" style={{ width: 'min(520px, 96%)' }} onSubmit={submit}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>Edit quote specs</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Saved to this quote only. The proposal, the quotes grid and the dashboard all read these
          same fields, so they update together.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          {FIELDS.map((f, i) => (
            <label key={f.k} style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{f.label}</span>
              <input ref={i === 0 ? firstRef : undefined} value={form[f.k]} onChange={set(f.k)}
                disabled={saving} autoComplete="off" spellCheck={f.k !== 'quote_id'} />
              {f.k === 'quote_id' && idError && (
                <span style={{ fontSize: 12, color: '#e5484d' }}>{idError}</span>
              )}
            </label>
          ))}
        </div>

        {/* Renaming the Proposal ID renames the record everywhere it is read FROM the quote row —
            the proposal header, the grid, the dashboard, the URL. It cannot reach back into things
            already MINTED with the old string, and the rep is the only one who can judge whether
            that matters, so name them instead of either blocking the edit or staying quiet. */}
        {idChanged && !idError && (
          <div style={{ marginTop: 12, padding: '9px 12px', background: 'var(--gold-soft)', border: '1px solid var(--gold)', borderRadius: 8, fontSize: 12.5 }}>
            <b>Renaming {current.quote_id} → {form.quote_id.trim()}.</b>
            <div style={{ marginTop: 4 }}>
              Saved revisions keep their old labels (<code>{current.quote_id}-rev1</code> and so on)
              {paymentLink ? ', and the payment link already created for this quote still shows the old ID on Shopify' : ''}.
              Everything else — the proposal, the grid, the dashboard, this page's address — follows the new ID.
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '9px 12px', background: '#fdecec', border: '1px solid #e5484d', borderRadius: 8, fontSize: 13, color: '#a3161a' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="ghost" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !!idError}>{saving ? 'Saving…' : '💾 Save changes'}</button>
        </div>
      </form>
    </div>
  )
}
