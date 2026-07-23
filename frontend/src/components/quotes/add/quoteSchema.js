import { z } from 'zod'

// Intake defaults — one key per field the create-quote endpoint accepts at intake.
export const EMPTY = {
  quote_id: '', company_name: '', client_name: '', contact: '', email: '', address: '',
  job_name: '', special_requirements: '', sales_rep: '', quote_source: '',
}

// Quote IDs are MANUAL (team decision, 2026-07): the rep assigns their own EC number so quotes
// stay trackable against however the team numbers things elsewhere — no more server-picked IDs.
// Format mirrors the backend's own check (QuoteController::store) so a bad ID is caught before
// the round-trip, not after.
export const QUOTE_ID_RE = /^EC\d{4,12}$/i

// Intake rules: Quote ID required + formatted, at least ONE of Company / Client (#7), Job Name
// required (#6). Sales rep stays optional (#13): blank = N/A (shared quote).
export const quoteSchema = z.object({
  quote_id: z.string(),
  company_name: z.string(),
  client_name: z.string(),
  contact: z.string(),
  email: z.string(),
  address: z.string(),
  job_name: z.string(),
  special_requirements: z.string(),
  sales_rep: z.string(),
  quote_source: z.string(),
}).superRefine((v, ctx) => {
  const qid = v.quote_id.trim()
  if (!qid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quote_id'], message: 'Quote ID is required — e.g. EC100123.' })
  } else if (!QUOTE_ID_RE.test(qid)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quote_id'], message: 'Quote ID must be EC followed by numbers (e.g. EC100123).' })
  }
  if (!v.company_name.trim() && !v.client_name.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['company_name'], message: 'Enter a Company Name or a Client Name (at least one).' })
  }
  if (!v.job_name.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['job_name'], message: 'Job Name is required.' })
  }
})
