import { sanitizePhone, useContactMethod } from '../../utils/contactMethod'

// Presentational "Client Information" wizard step. All state lives in Generator();
// this component only renders the controlled fields and calls back.
export default function ClientStep({ client, setClient, admin, reps, repOther, setRepOther, saveClient }) {
  const [contactMethod, setContactMethod] = useContactMethod(client.email, client.contact)
  // Switching method is a real choice, not just "which box is showing" — the OTHER field is
  // cleared so nothing stale is left behind for email-preferring displays elsewhere (Proposal,
  // quote list, payment links) to pick up instead of what the rep actually selected.
  const onContactMethodChange = (v) => {
    setContactMethod(v)
    setClient({ ...client, [v === 'phone' ? 'email' : 'contact']: '' })
  }
  return (
    <div className="step">
      <div className="step-head"><span className="step-icon">👤</span><h3>Client Information</h3></div>
      <div className="step-section">1. Company &amp; client</div>
      {[['company_name', 'Company Name'], ['client_name', 'Client Name']].map(([k, label]) => (
        <div className="field" key={k}>
          <label>{label}</label>
          <input
            type="text"
            value={client[k] || ''}
            onChange={(e) => setClient({ ...client, [k]: e.target.value })}
          />
        </div>
      ))}
      <div className="step-section">2. Contact details</div>
      <div className="field">
        <label>
          Contact{' '}
          <select value={contactMethod} onChange={(e) => onContactMethodChange(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </label>
        {contactMethod === 'phone' ? (
          <input type="text" inputMode="tel" placeholder="digits only"
            value={client.contact || ''}
            onChange={(e) => setClient({ ...client, contact: sanitizePhone(e.target.value) })} />
        ) : (
          <input type="email" placeholder="name@company.com"
            value={client.email || ''}
            onChange={(e) => setClient({ ...client, email: e.target.value })} />
        )}
      </div>
      <div className="field">
        <label>Address</label>
        <input type="text" value={client.address || ''} onChange={(e) => setClient({ ...client, address: e.target.value })} />
      </div>
      <div className="step-section">3. Job details</div>
      <div className="field">
        <label>Job Name</label>
        <input type="text" value={client.job_name || ''} onChange={(e) => setClient({ ...client, job_name: e.target.value })} />
      </div>
      <div className="field">
        <label>Sales Representative</label>
        {admin ? (() => {
          const custom = repOther || (client.sales_rep && !reps.includes(client.sales_rep))
          return (
            <>
              <select
                value={custom ? '__other__' : client.sales_rep}
                onChange={(e) => {
                  if (e.target.value === '__other__') { setRepOther(true); setClient({ ...client, sales_rep: '' }) }
                  else { setRepOther(false); setClient({ ...client, sales_rep: e.target.value }) }
                }}
              >
                <option value="">— select —</option>
                {reps.map((r) => <option key={r} value={r}>{r}</option>)}
                <option value="__other__">Other (type a name)…</option>
              </select>
              {custom && (
                <input style={{ marginTop: 8 }} placeholder="Type the sales rep's name" autoFocus
                  value={client.sales_rep} onChange={(e) => setClient({ ...client, sales_rep: e.target.value })} />
              )}
            </>
          )
        })() : (<input value={client.sales_rep || '—'} disabled />)}
      </div>
      {/* payment link is created later on the proposal via Shopify (#2) — not asked up front */}
      <div className="foot">
        <span />{/* Back moved to the top-left bar (#4) */}
        <button onClick={saveClient}>Next →</button>
      </div>
    </div>
  )
}
