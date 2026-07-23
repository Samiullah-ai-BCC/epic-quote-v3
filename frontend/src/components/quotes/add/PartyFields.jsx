import { Controller, useWatch } from 'react-hook-form'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { sanitizePhone, useContactMethod } from '../../../utils/contactMethod'

// Party fields that AI fills in (shown only after the read in AI mode; always in Custom).
// Company autofill (#8/#9): known companies suggest as you type; a matched company fills its
// ADDRESS only — the rep picks the exact contact from the dropdown (dropdown-ONLY autofill,
// Sami 2026-07-14: auto-applying the first contact kept picking wrong people).
export default function PartyFields({ control, register, setValue, choice, companyHits, exactHit, onCompanyChange, onPickContact, sources }) {
  const email = useWatch({ control, name: 'email' })
  const contact = useWatch({ control, name: 'contact' })
  const [contactMethod, setContactMethod] = useContactMethod(email, contact)
  // Switching method is a real choice, not just "which box is showing" — the OTHER field is
  // cleared so nothing stale is left behind for email-preferring displays elsewhere (Proposal,
  // quote list, payment links) to pick up instead of what the rep actually selected.
  const onContactMethodChange = (v) => {
    setContactMethod(v)
    setValue(v === 'phone' ? 'email' : 'contact', '')
  }
  return (
    <>
      <div className="grid gap-1.5 mb-3">
        <Label htmlFor="nq-qid">Quote ID <span className="muted font-normal">(required — assign your own, e.g. EC100123)</span></Label>
        <Controller name="quote_id" control={control} render={({ field }) => (
          <Input id="nq-qid" placeholder="EC100123" autoFocus
            value={field.value} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
        )} />
      </div>
      <div className="grid gap-1.5 mb-3">
        <Label htmlFor="nq-company">Company Name <span className="muted font-normal">(Company or Client required)</span>{choice === 'ai' && <span className="muted font-normal"> — the sign company on the drawing</span>}</Label>
        <Controller name="company_name" control={control} render={({ field }) => (
          <Input id="nq-company" list="company-suggestions" placeholder="Start typing — repeat customers autofill"
            value={field.value} onChange={(e) => { field.onChange(e.target.value); onCompanyChange(e.target.value) }} />
        )} />
        <datalist id="company-suggestions">
          {companyHits.map((c) => <option key={c.name} value={c.name} />)}
        </datalist>
        {exactHit && (
          <div className="text-[11px] text-gold">✓ Known company — details autofilled (edit anything that changed)</div>
        )}
        {exactHit && (exactHit.contacts || []).length > 0 && (
          <select
            className="mt-1.5 text-xs"
            onChange={(e) => { const c = exactHit.contacts[Number(e.target.value)]; if (c) onPickContact(c) }}
            defaultValue=""
            title="Every saved contact for this company — pick one to autofill"
          >
            <option value="" disabled>Saved contacts for this company ({exactHit.contacts.length}) — pick one…</option>
            {/* one contact method per row — email is primary, phone only when there's no email */}
            {exactHit.contacts.map((c, i) => (
              <option key={i} value={i}>{[c.client_name, c.email || c.contact].filter(Boolean).join(' · ') || '(blank)'}</option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="grid gap-1.5">
          <Label htmlFor="nq-client">Client Name <span className="muted font-normal">(Company or Client required)</span></Label>
          <Input id="nq-client" {...register('client_name')} />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="nq-contact">Contact</Label>
            <Select value={contactMethod} onValueChange={onContactMethodChange}>
              <SelectTrigger className="h-7 w-25 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {contactMethod === 'phone' ? (
            <Controller name="contact" control={control} render={({ field }) => (
              <Input id="nq-contact" inputMode="tel" placeholder="digits only"
                value={field.value} onChange={(e) => field.onChange(sanitizePhone(e.target.value))} />
            )} />
          ) : (
            <Input id="nq-contact" type="email" placeholder="name@company.com" {...register('email')} />
          )}
        </div>
      </div>
      <div className="grid gap-1.5 mb-3">
        <Label htmlFor="nq-address">Address</Label>
        <Input id="nq-address" {...register('address')} />
      </div>
      <div className="grid gap-1.5 mb-3">
        <Label htmlFor="nq-job">Job Name <span className="muted font-normal">(required)</span></Label>
        <Input id="nq-job" {...register('job_name')} />
      </div>
      <div className="grid gap-1.5 mb-3">
        <Label>Where did this quote come from?</Label>
        <Controller name="quote_source" control={control} render={({ field }) => (
          <Select value={field.value || '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— not sure —</SelectItem>
              {sources.map((qs) => <SelectItem key={qs} value={qs}>{qs}</SelectItem>)}
            </SelectContent>
          </Select>
        )} />
      </div>
    </>
  )
}

// Rep field — not AI-driven, so always shown up front.
// Admin: pick a rep, N/A (shared) or type a custom name. Non-admin: locked to yourself.
export function RepField({ control, register, isAdmin, reps, user, repOther, setRepOther, setValue, salesRep }) {
  const custom = repOther || (salesRep && !reps.includes(salesRep))
  return (
    <div className="grid gap-1.5 mb-3">
      <Label>Sales Representative {isAdmin ? '(optional)' : '(you)'}</Label>
      {isAdmin ? (
        <>
          <Controller name="sales_rep" control={control} render={({ field }) => (
            <Select
              value={custom ? '__other__' : (field.value || '__na__')}
              onValueChange={(v) => {
                if (v === '__other__') { setRepOther(true); field.onChange('') }
                else { setRepOther(false); field.onChange(v === '__na__' ? '' : v) }
              }}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__na__">— N/A (no rep — shared) —</SelectItem>
                {reps.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                <SelectItem value="__other__">Other (type a name)…</SelectItem>
              </SelectContent>
            </Select>
          )} />
          {custom && (
            <Input className="mt-2" placeholder="Type the sales rep's name" autoFocus {...register('sales_rep')} />
          )}
        </>
      ) : (<Input value={user?.full_name || ''} disabled />)}
    </div>
  )
}
