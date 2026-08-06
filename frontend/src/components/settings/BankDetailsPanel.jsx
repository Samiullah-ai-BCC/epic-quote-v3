import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { selectIsAdmin } from '../../store/authSlice'
import { getBankDetails, setBankDetails } from '../../api/meta'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

/* The company's wire-transfer details, as printed on proposals.

   WHY THIS EXISTS: Shopify takes 3% of every quote paid through its link. Printing wire
   instructions on the proposal instead costs nothing. A rep chooses, per quote, whether a
   proposal shows the Shopify button, these details, or both.

   ONE SET, COMPANY-WIDE, ADMIN-ONLY. An account number is money data: a single wrong digit sends
   a customer's payment somewhere it cannot be recovered from, and there is no reason for every
   rep to be able to retype it on every quote. Reps keep the per-quote choice; they do not get the
   numbers. The server enforces this — everything here is presentation. */

const FIELDS = [
  { key: 'title', label: 'Title', hint: 'Account holder and bank, as it should read on the proposal', placeholder: 'Epic Craftings Inc. (Bank of America)' },
  { key: 'account_number', label: 'Account number', hint: '', placeholder: '444030406654' },
  { key: 'routing_number', label: 'Routing number', hint: '', placeholder: '026009593' },
  { key: 'routing_note', label: 'Routing note', hint: 'Printed in brackets after the routing number', placeholder: 'Wire Transfer' },
  { key: 'address', label: 'Address', hint: '', placeholder: '101 E Luzerne St # B Philadelphia, PA 19124 4201' },
]

const BLANK = { title: '', account_number: '', routing_number: '', routing_note: '', address: '' }

export default function BankDetailsPanel() {
  const isAdmin = useSelector(selectIsAdmin)
  const [bank, setBank] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    getBankDetails().then((b) => setBank({ ...BLANK, ...(b || {}) })).catch(() => setBank({ ...BLANK }))
  }, [])

  if (!bank) return null

  const set = (key, value) => { setBank((b) => ({ ...b, [key]: value })); setDone(''); setError('') }

  const save = async () => {
    setError(''); setDone(''); setBusy(true)
    try {
      setBank({ ...BLANK, ...(await setBankDetails(bank)) })
      setDone('Saved. Proposals rendered from now on show these details; already-downloaded files are unchanged.')
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save the bank details.')
    } finally { setBusy(false) }
  }

  const filled = !!(bank.title || bank.account_number)

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-sm font-bold">Bank details on proposals</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Wire instructions a quote can print instead of the Shopify pay button, which costs 3%.
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${
          filled
            ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
            : 'text-amber-700 border-amber-300 bg-amber-50'}`}>
          {filled ? 'Saved' : 'Not set'}
        </span>
      </div>

      {error && <div className="mt-3 text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {done && <div className="mt-3 text-[13px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{done}</div>}

      <div className="mt-4 grid gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="grid gap-1">
            <span className="text-xs font-semibold">{f.label}</span>
            <Input value={bank[f.key] || ''} placeholder={f.placeholder} disabled={!isAdmin || busy}
              onChange={(e) => set(f.key, e.target.value)} />
            {f.hint && <span className="text-[11px] text-muted-foreground">{f.hint}</span>}
          </label>
        ))}
      </div>

      {isAdmin ? (
        <>
          <Button className="mt-4" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save bank details'}</Button>
          {/* Clearing every field is a real, supported action — it is the off switch. Saying so
              here stops an admin emptying the fields and wondering whether it worked. */}
          <p className="text-[11px] text-muted-foreground mt-2">
            Leave every field empty to stop the bank block printing on any proposal.
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-4">
          Only administrators can change these. You can still choose, per quote, whether they print.
        </p>
      )}
    </section>
  )
}
