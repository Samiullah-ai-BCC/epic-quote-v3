import { z } from 'zod'

// Intake defaults — one key per field the create-quote endpoint accepts at intake.
export const EMPTY = {
  company_name: '', client_name: '', contact: '', email: '', address: '',
  job_name: '', special_requirements: '', sales_rep: '', quote_source: '',
}

// Intake rules: at least ONE of Company / Client (#7), Job Name required (#6).
// Sales rep stays optional (#13): blank = N/A (shared quote).
export const quoteSchema = z.object({
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
  if (!v.company_name.trim() && !v.client_name.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['company_name'], message: 'Enter a Company Name or a Client Name (at least one).' })
  }
  if (!v.job_name.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['job_name'], message: 'Job Name is required.' })
  }
})
