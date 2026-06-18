import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConstants, useCreateQuote } from '../hooks'
import { nextOrderId } from '../api/quotes'
import useAuthStore from '../store/authStore'

const EMPTY = {
  quote_id: '', company_name: '', client_name: '', contact: '', address: '',
  job_name: '', order_id: '', special_requirements: '', sales_rep: '', quote_source: '',
}

export default function AddQuoteModal({ onClose }) {
  const navigate = useNavigate()
  const { data: constants } = useConstants()
  const create = useCreateQuote()
  const { user, isAdmin } = useAuthStore()

  const [choice, setChoice] = useState(null)   // null | 'scratch' | 'ai'
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    nextOrderId().then((id) => setForm((f) => ({ ...f, order_id: id }))).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const validId = (v) => /^[A-Za-z0-9_-]+$/.test(v) && v.length <= 20

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.quote_id.trim()) return setError('Quote ID is required')
    if (!validId(form.quote_id.trim())) return setError('Quote ID: letters, numbers, - and _ only, max 20')
    if (!form.company_name.trim()) return setError('Company Name is required')
    if (choice === 'ai' && !file && !form.special_requirements.trim()) {
      return setError('AI mode needs a PDF/image or some project details to read from.')
    }

    const payload = { ...form }
    if (file) payload.customer_pdf = file
    try {
      const created = await create.mutateAsync(payload)
      if (choice === 'ai') {
        // jump straight into the generator and auto-run AI extraction
        navigate(`/quotes/${created.quote_id}/generate?ai=1`)
      } else {
        onClose(true)
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create quote')
    }
  }

  const reps = constants?.sales_reps || []
  const sources = constants?.quote_sources || []

  // Step 1 — choose how to build
  if (!choice) {
    return (
      <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
        <div className="modal" style={{ width: 620 }}>
          <h2>New Quote — how do you want to start?</h2>
          <div className="choice-row">
            <div className="choice-tile" onClick={() => setChoice('ai')}>
              <div className="ico">⚡</div>
              <h3>AI Mode</h3>
              <p>Upload the customer's drawing/PDF or paste the brief. AI reads it and pre-fills the sign type and specs for you.</p>
            </div>
            <div className="choice-tile" onClick={() => setChoice('scratch')}>
              <div className="ico">✍️</div>
              <h3>Start from Scratch</h3>
              <p>Enter the quote details manually and build the specification step by step yourself.</p>
            </div>
          </div>
          <div className="foot"><button className="ghost" onClick={() => onClose(false)}>Cancel</button></div>
        </div>
      </div>
    )
  }

  // Step 2 — quote details form
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <form className="modal" onSubmit={submit}>
        <h2>{choice === 'ai' ? '⚡ New Quote — AI Mode' : 'New Quote — From Scratch'}</h2>

        {choice === 'ai' && (
          <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
            Attach the customer's PDF/image (or describe the project) below — AI will extract the specs in the next step.
          </p>
        )}

        <div className="grid2">
          <div className="field">
            <label>Quote ID *</label>
            <input value={form.quote_id} onChange={set('quote_id')} placeholder="e.g. Q-2026-001" autoFocus />
          </div>
          <div className="field">
            <label>Order ID</label>
            <input value={form.order_id} onChange={set('order_id')} />
          </div>
        </div>

        <div className="field">
          <label>Company Name *</label>
          <input value={form.company_name} onChange={set('company_name')} />
        </div>

        <div className="grid2">
          <div className="field"><label>Client Name</label><input value={form.client_name} onChange={set('client_name')} /></div>
          <div className="field"><label>Contact (email/phone)</label><input value={form.contact} onChange={set('contact')} /></div>
        </div>

        <div className="field"><label>Address</label><input value={form.address} onChange={set('address')} /></div>
        <div className="field"><label>Job Name</label><input value={form.job_name} onChange={set('job_name')} /></div>

        <div className="grid2">
          <div className="field">
            <label>Sales Representative {!isAdmin() && '(you)'}</label>
            {isAdmin() ? (
              <select value={form.sales_rep} onChange={set('sales_rep')}>
                <option value="">— select —</option>
                {reps.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (<input value={user?.full_name || ''} disabled />)}
          </div>
          <div className="field">
            <label>Quote Source</label>
            <select value={form.quote_source} onChange={set('quote_source')}>
              <option value="">— select —</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label>{choice === 'ai' ? 'Project brief (what the customer wants)' : 'Special Requirements'}</label>
          <textarea rows={choice === 'ai' ? 3 : 2} value={form.special_requirements} onChange={set('special_requirements')} />
        </div>

        <div className="field">
          <label>Customer PDF / Image {choice === 'ai' && '— AI will read this'} (max 25 MB)</label>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </div>

        {error && <p className="err">{error}</p>}

        <div className="foot">
          <button type="button" className="ghost" onClick={() => setChoice(null)}>← Back</button>
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : choice === 'ai' ? 'Create & Run AI →' : 'Create Quote'}
          </button>
        </div>
      </form>
    </div>
  )
}
