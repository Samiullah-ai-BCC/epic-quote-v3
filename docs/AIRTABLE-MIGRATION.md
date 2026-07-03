# Airtable → Estimator Migration — Zero-Abstraction Working Document

**Goal (from the team meeting):** kill the existing Airtable dashboard / quote creation / managing / history and move the whole team onto the Estimator. Hard requirement: the Estimator must consume **every** Airtable feature the team actually uses AND be better — no desynchronized behavior, no abstraction, whatever it costs.

**Sources:** full read-only tour of the team's base **"Business sign-Epic Craftings USA Project"** on 2026-07-03 (all 11 tables, every field + select option, both interfaces, record volumes) + the estimator codebase. Confidential record values stay out of this document — structure and vocabulary only.

---

## A. What the Estimator already has (native terms)

### A1. Quote intake ("+ New quote" modal)
- Two modes chosen at intake: **Quote Generator (AI)** and **Custom Quote Creator (manual mode)**.
- AI mode: multi-file upload (all files feed the AI) or paste-text extraction; Sales Rep (preset + type-any-name) and Payment link up front; Company required.
- Quote IDs auto-generated `EC{counter}`; custom IDs must be EC+digits, case-insensitive-unique; the counter **continues past Airtable's highest** when AIRTABLE_* env vars are set.

### A2. The wizard
- AI flow: Client Information → Project (AI summary, — for unknowns, full-reading expander, Re-read, Replace-with-auto-re-read) → Select Sign Type (41-type catalog + team custom types + type-your-own) → Specifications (typed Q&A: H×W(/D) dim boxes, required price > $0, chips) → Artwork & Notes → Preview.
- Manual flow: Client Information → Custom Specifications (full catalog dropdown + new-type-with-template, dims synced into spec text, price gate, special requirements) → Preview.
- **Live preview** beside every step, fully editable, ~1s updates.

### A3. The proposal
- Print-perfect page; per-block dirty tracking; ↻ Rebuild spec text; auto-anchored color swatches + artwork color picker; auto size arrows; AI-cropped artwork; side-view tiling + named team library + explicit "No side view"; validated payment-link button; vector Save-as-PDF + PNG.

### A4–A8. Dashboard (KPIs/needs-attention/pipeline, rolling 30d), All Quotes (search/filter/inline edit/status+chips/History), Users & roles (admin/manager/sales_rep; visibleTo scoping), Activity Log (every action, user/quote/action filters, per-user analytics incl. zero-action members), Sales Reports (per-rep, rolling 7/30d).

### A9. Storage & integrations
- Cloudinary permanent uploads; in-app drawing viewer; Groq AI (extraction, specs, side-view, artwork box); Airtable ID-sync scaffold; Shopify payment-link design agreed (pending credentials).

---

## B. What's in Airtable (the tour, zero abstraction)

Base: **Business sign-Epic Craftings USA Project** — one base, 11 tables, 2 interfaces. Live daily (new records the day of the tour).

### B1. `Quotes- working` — their quote pipeline. **3,371 records, active daily.**
The Airtable twin of our All Quotes + wizard output. Fields that matter:
- **Quote ID** (text; currently at **EC116561+** — far ahead of the estimator's counter) and **"Secondary Portal Quote ID"** — they already record OUR estimator IDs against their quotes.
- **Status** — ONE multi-select with **47 options** doing five different jobs at once:
  - real statuses: To Do, In progress, Done, Revision needed, Quote Approval Needed, Need To Share with Customer, No Response from Client, Rejected by Client, on hold, Ignored, Out Of Scope, Test Quote
  - urgency: Rush, Super Rush
  - **people as statuses** (assignment abuse): Faraz Awan, khola, khansa, alishan, mussawer, yasir, Rod, Ed Weikle, Usman Altaf
  - **action reminders as statuses**: add price / Check Price / Calculate price, Review quote, need to reply rod, waiting for rod reply, Need to share with sir sami / Ed / ROD, review quote by sir sami, waiting for Sami sir reply, waiting for client response, artwork send to client for approval, Artwork needs to be Added, Need to embed payment link, check quote from China, check from production, Shared with Team USA
  - **approval guards as statuses**: "Don't Work or Share with Anyone without Faraz's Approval", "Do not send without Faraz's approval"
  - garbage: client names, "Email", stray values.
- Money: Breakeven Production / Shipping / Total (formula), **Final Price**, **Profit Percentage** (formula), **Price Approved** (checkbox), **Approved By**.
- People: **Account Manager** (Rod Muffet, Ed Weikle), **Added by / Created by / Submitted by** (Faraz, Khola, Khansa, Mussawer, Ali Shan), Assignee (dirty).
- Files: PDF (drawings), Proposal (attachment), Source File, Crunched Dimensions.
- Process: Quote Received Via (**Email, Client Portal, Google Ads, WhatsApp**), Quote Added Manually, Revision Notes, IMPORTANT UPDATES, internal Quotation Notes, Follow up Sent/Notes, Quote Followup Sent?, **Order Placed / Converted to Order** (checkboxes), Status Done Date + **Time Taken Hours (Status Done)** (formula), Quote Month Report (for monthly charts), Data Needed (link to Tasks).
- Per-sign leftovers: returnDepth, signFont, trimColor, woodColor, Raceway Color, Backers Color, Dimensions (free text), Payment link (free text).

### B2. `Mastersheet` — the ORDER lifecycle. **1,370 records, ~170 fields, active daily.**
Everything that happens after a quote converts. Order codes are a **different sequence: `BS-US-####`** (e.g. BS-US-2427; "RE" suffix = remake/reorder).
- **Status** — one multi-select with ~50 options = the entire production+fulfilment pipeline crammed into one field: To do → CDR Needed → Detail Drawings Needed → Cutting needed/Cut → Welding → Paint → UV Printing → PVD → Vinyl Application → Assembly/Pre-Assembly → Q/A → Photo approval needed / Photo Rejected → Packed → Box Needed → Shipping needed → Shipped → Shipped to Philly → Delivered to Philly → Delivered to Customer → Done; branches: Repair/Repairing/Repaint/Re-UV, Damaged, Refunded, Cancelled, on hold, Stop Production, Decision Pending, Moved to China, USA-Production Moved, ISP (Inventory Shortage), Rush/Super Rush; plus garbage entries ("$2", "550.00", duplicates with different capitalization).
- **Payments** (the deposit→remaining flow, mirrors our 50/50 proposal): Received Payment, Remaining Payment (+date, status Payment pending/complete, "Remaining Payment done"), Payment Method (Stripe/Shopify/BOA ×2/ACH/Meezan/none), Payment Received Via (+ per-account currency splits: shopify / EC LLC / EC Inc), **Shopify Order ID (Initial)** and **(Full)**, Payment Proof attachments, Payment Link Sent, Credit + Credit issued date + Credit Applied, Rod-specific payment fields (status Initial/Remaining/Complete, deposit, received formulas), Tax Certificate.
- **Production**: Production Unit (**Pakistan / USA / China**), Moved to Production (+time, days-since formula), BOM Done, bom_production_cost / bom_shipping_cost (formulas), Actual Production/Shipment Cost Pakistan (+GMS variants), Amount Paid to China (+proof), Production/Shipment/Installation Cost (Signarama Philly), Philly Expense Details, Relevant Files + Instructions for Philly Office, USA Office Status (Waiting for shipment → Received → Dispatched → Delivered → Target task completed), IMPORTANT Notes for USA office, Amount Spent by USA office.
- **Shipping**: two legs — Tracking (PAK to Philly) and Tracking (Philly to Client), Tracking ID/Number, Shipment Carrier (DHL/FedEx/UPS/USPS/Freightquote/Turkish Airlines Cargo + garbage), Shipping Company, Est Shipping Cost, Expected Delivery Date (Philly), Shipment date, Tracking Sent?, "Tracking id send to Shopify".
- **Finance/profit** (formula suite): Total Breakeven, Total Cost (Proposal), Total Actual Cost (Pakistan-only / all factories), Estimated + Actual Profit (USD/%), Profit Factor (Estimated/Actual/Philly), Net Revenue (3% card fee deducted), Cost Difference (Proposal − Actual) for production and shipping, "Actual cost Estimated/Actual" flags, Finance Details Verified (checkbox), All Finance Details Added; **"FD - …" duplicate field set** (~18 fields) = a locked finance-department copy of the money columns.
- **Customer-facing**: Design Image / Proof / Images shared with Customer / Feedback Review-Proofs attachments, Review Feedback (Positive/Negative), Feedback Date, Issue Reported Details, Message sent / Email Needs to be sent / Production Images Sent (checkboxes).
- **Spec snapshot on the order**: Sign Type (100+ messy options), Dimensions + Width/Height/Depth numbers, Design Text, Color, Neon color, Backlit (LED colors/temps), Finish, 3D/2D, Acrylic Shape, Font, Background material, Usage (indoor/outdoor — exists TWICE as separate fields).
- **Ownership**: Account Name (mixed garbage), Client's Segregation (**Rod's Clients / Ed Weikle's Clients / Epic cum Rod's Clients**), Rod Muffet / ED Weikle checkboxes, "To be added in rod report" / "Added in Rod Muffet report (Complete)".
- Timestamps everywhere: Order Added (created), Order Date, Month Added (manual select — Jan 2025…Jul 2026), Last Modified (status) ×2, Orders Marked Shipped, Remaining Payment Received, Time since order Added (formula).

### B3. `Side Views` — their side-view library (≈ our team side-view library): Sign Type Detail, Side View PNG/PDF attachments, Material Thickness (3/6/12/18/25 mm), Mounting (VHB, Flush, Stud, Raceway, ACM Backer, Flat Backer, Backer-board Cabinet), Backer Thickness (2–24 mm), Sign Type category (18 clean options: Flat Cut Acrylic/Aluminium, Face-Lit, Halo-Lit, Fabricated, Lightbox ×2, PushThrough, Side Lit, Face+Side Lit, Blade, Face+Halo, UV Neon, Open Face Neon, Marquee, Infinity, Metal on Acrylic, Vacuum Formed).

### B4. `EC Catalouge Data` — sign-type catalog (≈ our catalog + team custom types): Sign Type, Specifications text, Example Pictures, Side View attachments, Status (Todo/In progress/Done — it's half-built).

### B5. `Clients Data` — CRM/portal accounts: Team-vs-Client user type, **plain-text Password column (!!)**, active/pending status, company, country/state/city/zip, phone, website, Business Focus/Type (choice lists polluted by comma-joined combinations — dozens of pseudo-duplicates). This is the account table behind the **Client Portal** ("Quote Received Via: Client Portal").

### B6. `Tasks Reporting` — internal task assignment linked to quotes AND orders: task name, Category (Order/Quote/Report/Social Media/Calculator/**Portal-Website**/Other), Todo/In-progress/Done, Deadline, Assigned to (Amna, Faraz, Ayesha, Ahmad, Mussawer), Assigned By (+ "Usman Boss"), attachments, comments, lookups pulling Quote ID + customer from the linked records.

### B7. `Finances` — expense ledger: order code, Paid by (Futura Identities / EC Pakistan-Blue Cascade / EC inc.), amount USD + PKR, date, payment mode.

### B8. `Todo Tasks` — trivial personal todos. `Credit info` — client credit workflow (amount, notes, status, issued/approved checkboxes, assignee, attachments). `Social Media Posting` — content pipeline (sign type, attachments, assignee, posted). `Interface Report` — one-row helper table feeding dashboard KPIs (Profit Factor, Production TAT, Negative Feedbacks — today/this-month).

### B9. Interfaces (the role dashboards)
- **REPORT → Profit & Loss Report**: order count, selling price sum, breakeven sum + % filled, estimated profit + factor + %, actual cost/profit/factor/%, pending-payments count + remaining-payment sum, remaining-payment-over-time line chart, revenue-by-month bar/line.
- **EC USA → Rod Report (+copy)**: Rod-scoped payment ledger (order/customer/company/price/breakeven/payment status/received/date), initial vs remaining sums, Rod-clients vs Epic-cum-Rod splits, credit given (count/amount/detail rows), Net Revenue after 3% card fee.
- **EC USA → Daily Report - Khola**: today's order count/revenue total + per production unit, samples count+cost, replacements count+cost, revenue-by-workshop chart, Profit Factor / Avg Production TAT / Negative Feedbacks (from Interface Report), same set for this-month.
- **EC USA → Monthly Report**: month's counts/revenue overall + per Pakistan/USA/China, samples, replacements, workshop revenue breakdown, month-over-month revenue chart, **quotation count + quotation amount + quotes-by-month chart**.
- No Airtable forms found (standaloneForms: []). Automations aren't visible via the connector (see F1).

### B10. Data-quality disease (why the estimator wins)
Free-for-all select fields have absorbed years of typos and misfiled data: prices, dates, phone numbers, email addresses and full shipping addresses stored as *select options*; duplicated options differing by case/spacing; two fields for the same thing (Usage ×2, several payment-received variants). Every one of these is impossible in the estimator's typed fields — this is the strongest selling point for the switch, and the reason import needs a cleaning pass.

---

## C. Reconciliation — every Airtable capability → estimator build

| # | Airtable capability | Estimator today | Gap → how we build it (our infra) | Phase |
|---|---|---|---|---|
| C1 | Quotes-working pipeline (3,371 quotes) | All Quotes + wizard | Import all records as quotes (EC ids preserved); "Secondary Portal Quote ID" proves the mapping | 1 |
| C2 | 47-option status mess | 10 clean statuses + "waiting on…" chips | Split their 47 into: statuses (exists), urgency **Rush/Super-Rush flag** (new field+filter+red highlight), assignment (real `assigned_to` user field — new), action reminders (chips), approval guards (see C5) | 2–3 |
| C3 | Breakeven/Final-Price/Profit%/Price-Approved | price only | Add breakeven production+shipping fields on the quote (specs page + All Quotes grid); profit % auto-computed; Price Approved checkbox + Approved By + approval timestamp in Activity | 3 |
| C4 | Account Manager (Rod/Ed) + client segregation | sales_rep | Keep sales_rep as Account Manager; import segregation as a client attribute (CRM, C13) | 1 |
| C5 | Approval guards ("don't share without Faraz's approval") | — | Real gate: quote flag `locked_until_approved` — blocks Save-as-PDF/PNG + payment-link + Share until a manager/admin approves (logged) | 3 |
| C6 | Follow-ups (sent?, notes, date) | — | Follow-up fields on quote + dashboard "needs follow-up" queue (needs-attention style) + reminder (F2) | 4 |
| C7 | Convert to Order (Order Placed, BS-US-#### code, "RE" remakes) | statuses stop at Done | **Orders module**: Convert button on a Done quote → order with own `BS-US-{counter}` id, carrying the quote snapshot; remake flow clones an order with "RE" suffix | 5 |
| C8 | Production pipeline (~20 real stages, 3 production units) | — | Order status field (single, staged: Production → QC → Photo Approval → Packed → Shipped legs → Delivered) + step-specific chips (Cutting/Welding/Paint/UV/PVD/Vinyl/Assembly/Repair/Re-UV/ISP…) + Production Unit (Pakistan/USA/China) + StatusHistory timeline per order | 5 |
| C9 | Payments (deposit/remaining, methods, accounts, proofs, Shopify order ids, credits) | payment link on proposal | Order payment panel: received/remaining amounts + dates, method + receiving account, proof uploads (Cloudinary), credit amount/date, Shopify order ids — auto-filled once Shopify integration lands | 5+Shopify |
| C10 | Two-leg shipping + tracking + carriers + costs | — | Order shipping panel: leg 1 (PAK→Philly) and leg 2 (Philly→Client), tracking numbers, carrier select (clean list), est vs actual cost, shipment date, expected delivery, "tracking sent" flag | 5 |
| C11 | Finance suite (actual costs per factory, profit formulas, FD-verified copy) | — | Order finance panel: cost inputs (Pakistan/China/Philly production+shipping+installation) → computed totals, estimated vs actual profit USD/% / factor, net revenue (card-fee aware); "Finance verified" lock that freezes the FD copy (admin-only edit after) | 6 |
| C12 | Customer feedback (proofs, Positive/Negative, issue details) | — | Order feedback panel + Negative-feedback KPI on the admin dashboard | 6 |
| C13 | Clients Data (CRM + portal accounts) | companies auto-created from intake | CRM page: clients list (import), business type/focus (clean multi-select), segregation, contact info; portal accounts imported with **forced password reset** (plain-text passwords must die at import) | 7 |
| C14 | Client Portal (quote requests come via portal) | — | Confirm scope (F3): likely a customer-facing "request a quote" page creating a quote in AI mode with uploads | 7 |
| C15 | Tasks Reporting | — | Lightweight Tasks page: task ↔ quote/order links, assignee, deadline, status, comments; "my tasks" on each user's dashboard | 4 |
| C16 | Side Views table | Named side-view team library | Import their library (attachments → Cloudinary) incl. thickness/mounting metadata as searchable tags in the picker | 1 |
| C17 | EC Catalouge Data | 41-type catalog + team custom types w/ templates | Import their entries as team custom types (spec text + example pictures + side view) | 1 |
| C18 | Interfaces P&L / Rod / Daily / Monthly | Dashboard + Sales Reports | **Admin Reports pages** reproducing every widget: P&L (est vs actual), per-manager ledger w/ credits + net revenue, daily ops (per-unit counts/revenue, samples, replacements, TAT, negative feedback), monthly (workshop breakdown, month charts, quote counts/amounts). All from our own order+quote data — no Interface-Report helper table needed | 6 |
| C19 | Finances ledger / Credit info / Social Media / Todo | — | Credit info folds into C9; Finances ledger = simple admin Expenses page (7); Social Media + Todo Tasks: propose keeping OUT of the estimator (F4) | 7 |
| C20 | Grid ergonomics (Airtable's core comfort) | plain tables | The **Grid component** (D4): sortable/hideable columns, sticky header, keyboard nav, inline edit, multi-select + bulk actions, copy/paste, CSV export, currency masking (digits-only price, clean re-entry), used on All Quotes, Orders, CRM, Tasks | 2 |
| C21 | Monthly bucketing (manual "Month Added"/"Quote Month Report" selects) | rolling windows | Auto-derived month grouping from real timestamps — the manual month-select disease disappears | 2 |
| C22 | ID systems | EC counter (~100k) | Quotes: adopt Airtable's sequence (counter jumps to 116,5xx via the sync scaffold — collision-proof). Orders: new `BS-US-{n}` counter continuing theirs (~2,43x) | 1 |

## D. Sami's asks mapped (updated with tour findings)
- **D1 Admin transparency dashboard** → C18 + existing Activity analytics; per-member drill-down of quotes touched, statuses moved, time-to-Done (their "Time Taken Hours" formula becomes real math from StatusHistory).
- **D2 Role views** → the real roles discovered: **Admin/boss (Usman)**, **Account Managers** (Rod, Ed — payment-ledger view = Rod Report), **Quote team** (Faraz, Khola, Khansa, Mussawer, Ali Shan — pipeline view), **Finance** (FD fields, verified lock — Arham), **Production/Philly office** (order stages, instructions, files), **Tasks people** (Amna, Ayesha, Ahmad). Role field extends to: admin, account_manager, quote_maker, finance, production, viewer.
- **D3 Fulfilment lifecycle** → C7–C12 (the Mastersheet IS this; now we know every stage by name).
- **D4 Spreadsheet utils** → C20.
- **D5 Zero desync** → two-way sync per field map (C1/C22) during parallel-run; last-write-wins + Activity-logged; full import at cut-over; Airtable then read-only until killed.

## E. Phased plan (final shape)
- **P0 done** — this document. → Sami approves + answers F.
- **P1 Sync & import foundations**: field mapping Quotes-working ↔ quotes; counter adoption (116,5xx); side-views + catalog import; import dry-run locally on the real 3,371.
- **P2 Grid + hygiene**: Grid component on All Quotes; currency masking; Rush/Super-Rush; auto month buckets.
- **P3 Roles & quote-team parity**: assigned_to; breakeven/profit/approval fields; approval gate; role model + per-role home pages.
- **P4 Follow-ups + Tasks**: follow-up queue + reminders; Tasks page.
- **P5 Orders module**: convert-to-order, BS-US ids, production pipeline, payments, shipping, remakes.
- **P6 Finance + Reports**: finance panel + verified lock; P&L/Rod/Daily/Monthly report pages; feedback KPIs.
- **P7 CRM + Portal + cut-over**: clients import (password reset), portal scope, expenses page; parallel-run checklist; full import; Airtable read-only; kill.

## F. Open questions for Sami
1. **Automations**: the connector can't see Airtable automations. Ask the team: do any automations run (emails on status change, Slack, reminders, Shopify tracking push — the "Tracking id send to Shopify" checkbox hints at one)? List them; each becomes an estimator job.
2. **Reminders/notifications**: when a quote needs follow-up or an order stalls, how do they want to be told — in-app queue only, or email too?
3. **Client Portal**: "Quote Received Via: Client Portal" + Clients Data with passwords + a Portal/Website task category — there IS a customer portal somewhere. What is it (the epiccraftings.com site? separate app?), and does the estimator replace it or integrate with it?
4. **Social Media Posting + Todo Tasks tables**: keep them in Airtable/elsewhere, or must the estimator absorb these too? (My call: out of scope — they're not quote/order work.)
5. **Order codes**: confirm orders keep the `BS-US-####` sequence (continuing from ~2,43x) and quotes keep EC-numbers continuing from 116,5xx.
6. **The "FD -" finance copy**: confirm my reading — finance re-enters the money numbers as a verified snapshot that the quote team can't touch. (Estimator version: a "Finance verified" lock instead of duplicate columns.)
7. **Who is Arham / GMS / Futura Identities / Blue Cascade** in role terms — finance role holders and paying entities? Needed for the Finance panel's account list.
8. **Parallel-run conflict rule**: last-write-wins with everything logged — confirm.
