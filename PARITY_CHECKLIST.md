# V3 Parity Checklist â€” Epic Craftings Quote Generator

> V1 (Flask/SQLite) is the **feature floor**. V3 must ship every item below.
> Tick each box when the phase that owns it passes manual + automated testing.
> "New" rows = V3 additions that have no V1 equivalent.

---

## P1 â€” Auth & RBAC

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 1 | Login (username + password) â†’ Sanctum token | `POST /api/login` | [x] |
| 2 | Logout (invalidate token) | `POST /api/logout` | [x] |
| 3 | `/api/me` â€” return current user or null | `GET /api/me` | [x] |
| 4 | Roles: `admin`, `sales_rep`, `manager` | `ROLES` constant | [x] |
| 5 | Admin-only nav: Users, Sales Reports, Activity Log | `navUsers`, `navSalesReports`, `navActivity` | [x] |
| 6 | Non-admin sees only their own quotes | `get_quote_or_403`, `Quote.sales_rep == current_user.full_name` | [x] |
| 7 | Admin can change `sales_rep` on a quote; non-admin cannot | `update_quote` | [x] |
| 8 | `last_login` timestamp tracked | `User.last_login` | [x] |
| 9 | Seed users on first boot (admin, rod, ed, sami + named business users) | `init_db` | [x] |

---

## P1 â€” User Management (Admin only)

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 10 | List users | `GET /api/users` | [x] |
| 11 | Create user (username, full_name, email, role, password) | `POST /api/users` | [x] |
| 12 | Edit user (username, full_name, email, role) | `PUT /api/users/{id}` | [x] |
| 13 | Delete user (cannot delete self) | `DELETE /api/users/{id}` | [x] |
| 14 | Admin resets user password (min 4 chars) | `PUT /api/users/{id}/password` | [x] |

---

## P2 â€” Schema & Catalog

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 15 | `users` table (id, username, password_hash, full_name, email, role, last_login, created_at) | `User` model | [x] |
| 16 | `companies` table (id, name, address, phone, email, created_at) | `Company` model | [x] |
| 17 | `representatives` table (id, company_id FK, name, email, phone, created_at) | `Representative` model | [x] |
| 18 | `quotes` table â€” full column set including order_id, crunched_artwork, final_created_by | `Quote` model | [x] |
| 19 | `quotes.generated_data` JSON column (full editor state) | `Quote.generated_data` | [x] |
| 20 | `status_history` table | `StatusHistory` model | [x] |
| 21 | `orders` table | `Order` model | [x] |
| 22 | `payments` table (link, total, deposit, balance) | `Payment` model | [x] |
| 23 | `activity_log` table | `ActivityLog` model | [x] |
| 24 | `settings` table (key/value) | `Setting` model | [x] |
| 25 | Quote counter seeded at 100000 (EC-prefix IDs) | `next_quote_id` | [x] |
| 26 | Order counter seeded at 100000 (ORD-prefix IDs) | `next_order_id` | [x] |
| 27 | **NEW** `quote_items` 1â†’N per quote (replaces single-row item table) | V3 addition | [x] |
| 28 | **NEW** MySQL (not SQLite) | stack decision | [x] |
| 29 | Sign type catalog â€” 29 types from V1 `T` array (must match verbatim names) | `SIGN_TYPE_NAMES` | [x] |
| 30 | Status options â€” 10 fixed statuses | `STATUS_OPTIONS` | [x] |
| 31 | Sales reps list (Rod Muffet, ED) | `SALES_REPS` | [x] |
| 32 | Quote sources (Email, Client Portal) | `QUOTE_SOURCES` | [x] |

---

## P3 â€” Quote Intake & List

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 33 | Add Quote modal: quote_id (manual, validated alphanumericâ‰¤20), company, client, contact, address, job_name, order_id (auto-suggested ORD-XXXXXX), special_requirements, customer PDF/image upload, sales_rep, quote_source | `openAddQuoteModal` / `POST /api/quotes` | [x] |
| 34 | Auto-create company if new (case-insensitive dedup) | `create_quote` | [x] |
| 35 | Auto-create representative if new client | `create_quote` | [x] |
| 36 | Quote ID validation: unique, alphanum+hyphen+underscore, â‰¤20 chars | `create_quote` | [x] |
| 37 | Customer PDF/image upload on create (max 25 MB) | `MAX_CONTENT_LENGTH` | [x] |
| 38 | Dashboard: monthly stats cards (total quotes, total amount, pending, per-status counts) | `GET /api/dashboard` | [x] |
| 39 | Dashboard: clickable status cards to filter quote list | `setStatusFilter` | [x] |
| 40 | Dashboard: quote search (quote_id, company, job_name, client_name) | `GET /api/quotes?search=` | [x] |
| 41 | Dashboard: status filter dropdown | `statusFilter` | [x] |
| 42 | Dashboard: quote cards (quote_id, company, price, client, job, rep, source, date, status) | `quoteCard` | [x] |
| 43 | Quote cards: inline status change | `updateStatus` | [x] |
| 44 | Quote cards: tags (add from status options, remove) | `addTagPrompt`, `removeTag` | [x] |
| 45 | Quote cards: "Make Quote" / "Continue / Edit" button | `openMakeQuoteModal` | [x] |
| 46 | Quote cards: "Company" button â†’ company detail | `openCompanyDetail` | [x] |
| 47 | All Quotes tab: wide table, inline editing of all fields | `loadAllQuotes` | [x] |
| 48 | All Quotes tab: file cells (Customer PDF, Artwork, Crunched Artwork) â€” view + replace upload | `aqFileCell` | [x] |
| 49 | All Quotes tab: View details modal | `viewQuoteDetails` | [x] |
| 50 | All Quotes tab: Edit (opens generator) | `editQuoteDirectly` | [x] |
| 51 | All Quotes tab: Delete quote (with confirm) | `deleteQuoteConfirm` | [x] |
| 52 | All Quotes tab: search + status filter (incl. "Pending" filter) | `loadAllQuotes` | [x] |
| 53 | Status history recorded on every status change | `StatusHistory` model | [x] |
| 54 | Activity log entry on: create, edit, status change, file upload, AI call, delete, login, logout, user CRUD, payment, company update | `log_activity` | [x] |

---

## P4 â€” Generator Wizard

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 55 | Mode picker modal: "Quote Generator" vs "Custom Quote Creator" | `modal-make-quote` | [x] |
| 56 | **Generator flow**: Client Info â†’ Project Info+AI â†’ Sign Type â†’ Q&A Specs â†’ Artwork â†’ Preview | `FLOWS.generator` | [x] |
| 57 | **Custom flow**: Client Info â†’ Artwork â†’ Custom Specs â†’ Preview | `FLOWS.custom` | [x] |
| 58 | Progress bar (steps done indicator) | `renderProgress` | [x] |
| 59 | Step: Client Info â€” edit company, client, contact, address, job name (saves to quote on Next) | `s1` / `genNextFromClient` | [x] |
| 60 | Step: Client Info â€” logo upload (global, applies to all quotes) | `loadLogo` | [x] |
| 61 | Step: Project Info â€” special requirements textarea (pre-filled from quote) | `s2` | [x] |
| 62 | Step: Project Info â€” customer PDF/image upload (saves to quote) | `loadProjFile` | [x] |
| 63 | Step: Sign Type â€” searchable list of 29 types, AI suggestion pre-selected | `s3` / `renderSigns` | [x] |
| 64 | Step: Q&A â€” adaptive questions per sign type (dimensions, returns, trim, mount, illumination, colors, application, price) | `buildQuestions` | [x] |
| 65 | Step: Q&A â€” chip selections for enum fields | `askNext` | [x] |
| 66 | Step: Q&A â€” AI defaults highlighted (âš¡), "Accept AI" / "Use default" skip buttons | `askNext` | [x] |
| 67 | Step: Artwork upload â€” image, preview shown, uploaded to server | `s5` / `loadArt` | [x] |
| 68 | Step: Artwork â€” Skip option | `skipArtwork` | [x] |
| 69 | Step: Custom Specs â€” 5 sample templates (Halo Lit, Cabinet, Neon, Flat Cut, Push Thru) | `CUSTOM_TEMPLATES` | [x] |
| 70 | Step: Custom Specs â€” item description, dimensions, spec text (free form), application, price | `s7` | [x] |
| 71 | Resume mid-flow: if generated_data exists, jump to preview step | `enterGenerator` hasProgress logic | [x] |
| 72 | Back navigation through all steps | `genBack` | [x] |

---

## P5 â€” AI Specs (Groq)

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 73 | Groq API call â€” text model for text-only context | `call_groq` | [x] |
| 74 | Groq vision model for image uploads (meta-llama/llama-4-scout) | `call_groq` with `image_data_url` | [x] |
| 75 | pypdf text extraction for customer PDFs | `extract_pdf_text` | [x] |
| 76 | Prompt includes: special_requirements + extra_info + pdf_text (or image) | `ai_generate_specs` | [x] |
| 77 | AI returns JSON: signType (verbatim), jobName, dimensions, returns, trimcap, mounting, illumination, faceColor, returnColor, application, price, notes | prompt schema | [x] |
| 78 | AI call is optional â€” user can skip and fill manually | UX | [x] |
| 79 | AI result displayed inline with field-by-field breakdown | `aiResult` div | [x] |
| 80 | "Continue to Artwork Upload" shortcut after AI (skips Q&A, uses AI defaults) | `continueFromAI` | [x] |
| 81 | Activity log entry on AI call | `log_activity('ai_generate_specs')` | [x] |

---

## P6 â€” Proposal Editor

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 82 | Proposal layout: header (logo + contact), title "Proposal", client info grid, item details box, item table, spec+notes, package includes, side view, footer (terms + totals) | `buildQuote` / `#page` HTML | [ ] |
| 83 | All text blocks contenteditable (data-key tracked) | `[data-key]` elements | [ ] |
| 84 | Text formatting toolbar: font family (8 options), A+/A-, bold, italic, underline, align (L/C/R/justify), letter spacing, line height | editor-toolbar | [ ] |
| 85 | Object toolbar: rotate Â±15Â°, layer up/down | `rotateSelected`, `layerSelected` | [ ] |
| 86 | Logo: adjustable position/size/rotation in header | `setupPageInteractivity` logoImg | [ ] |
| 87 | Customer artwork: adjustable position/size/rotation in item box | `setupPageInteractivity` img | [ ] |
| 88 | **NEW** Customer artwork persisted (size/pos/rotation saved) â€” V2 bug fix | `artworkGeom` in generated_data | [ ] |
| 89 | Side view images: adjustable, removable (Ã—), position/size/rotation persisted | `renderSideViews` / `makeAdjustable` | [ ] |
| 90 | Package items: adjustable, removable, position/size/rotation persisted | `renderPackageBody` / `makeAdjustable` | [ ] |
| 91 | Side view picker modal (multi-select from server-stored side_views) | `modal-side-view` / `openSideViewPicker` | [ ] |
| 92 | Package includes picker modal (installation_template, power_supply, adaptor, dimmer, hardware) | `modal-package` / `PACKAGE_OPTIONS` | [ ] |
| 93 | Color swatches with inline color picker for color spec fields | `swatch()` / `applySwatchColor` | [ ] |
| 94 | Dimensions (H Ã— W) shown as dimension labels on item box | `dim_h`, `dim_w` | [ ] |
| 95 | **NEW** Full editor state serialized to `proposal_state` JSON and saved to DB on every change | `saveProgress` â†’ `generated_data` (V2 bug fix) | [ ] |
| 96 | **NEW** Editor state fully restored when re-entering editor | `restoreTextStyles`, `restoreSwatchColors`, `artworkGeom`, `sideViews`, `packageItems`, `logoGeom` (V2 bug fix) | [ ] |
| 97 | Payment link input: save to quote, embedded in PDF | `savePaymentLink` | [ ] |
| 98 | Terms & conditions editable block (default text pre-filled) | `terms` data-key | [ ] |
| 99 | Totals section: subtotal, 50% deposit, 50% balance (auto-calculated, editable) | `tot_*` data-keys | [ ] |
| 100 | "Save & Return to Dashboard" saves state then exits | `saveAndExit` | [ ] |

---

## P7 â€” PDF Generation

| # | Feature | V1 source / V3 decision | Done |
|---|---------|-----------|------|
| 101 | **V1 compat** PNG download (html2canvas, hides payment button, hides editor handles) | `downloadPNG` | [ ] |
| 102 | **V3 primary** Server-side PDF via Gotenberg (headless Chrome) â€” replaces jsPDF screenshot | stack decision | [ ] |
| 103 | PDF download: full fidelity rendering of the proposal page | Gotenberg | [ ] |
| 104 | PDF: payment link embedded as clickable hyperlink | `pdf.link()` in V1; Gotenberg equivalent in V3 | [ ] |
| 105 | PDF stored in Laravel Storage (Render disk) | stack decision | [ ] |
| 106 | PDF accessible via download endpoint | `GET /api/quotes/{id}/pdf/download` | [ ] |

---

## P8 â€” Dashboard, Pipeline, CRM (restore from V1)

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 107 | Sales Reports (admin only): overall metrics + per-rep weekly/monthly | `GET /api/reports/sales-reps` | [x] |
| 108 | Activity Log (admin only): last 150 entries, user/action/details/timestamp | `GET /api/activity` | [x] |
| 109 | Companies list: name, phone, email, total quotes, total orders, conversion % | `GET /api/companies` | [ ] |
| 110 | Company detail: edit address/phone/email | `PUT /api/companies/{id}` | [ ] |
| 111 | Representatives: list, add, edit (name/email/phone), delete | rep endpoints | [ ] |
| 112 | Company stats: total quotes, total orders, conversion rate | `get_company` | [ ] |
| 113 | Company quote history table (clickable â†’ opens generator) | `cdQuotes` | [ ] |
| 114 | Company order history table | `cdOrders` | [ ] |
| 115 | Add company modal | `modal-add-company` | [ ] |
| 116 | Non-admin sees only companies with their quotes | `list_companies` filter | [ ] |
| 117 | Order Confirmation modal (select quote, currently stub â€” keep stub or implement) | `modal-order-confirm` | [ ] |
| 118 | Payment link: GET/PUT per quote, shows total/deposit/balance breakdown | `payment_link` endpoint | [ ] |
| 119 | Next order ID suggestion (auto-increment ORD-XXXXXX) | `GET /api/next-order-id` | [x] |

---

## P8 â€” File Storage

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 120 | Upload dirs: pdfs, artwork, logos, side_views, branding, package, custom_templates | `UPLOAD_DIR` subdirs | [ ] |
| 121 | Customer PDF/image (PDF or image, 25 MB max) | `upload_pdf` | [x] |
| 122 | Artwork image upload per quote | `upload_artwork` | [x] |
| 123 | Crunched dimension artwork (image or PDF) per quote | `upload_crunched_artwork` | [x] |
| 124 | Company logo upload (global, replaces branding logo) | `set_logo` | [x] |
| 125 | Side view images served from storage | `list_side_views` / `GET /api/side-views` | [x] |
| 126 | **NEW** Storage backend: Laravel Storage â†’ Render disk now, R2 later (env swap only) | stack decision | [x] |

---

## P9 â€” Real-time & Hardening

| # | Feature | V1 source | Done |
|---|---------|-----------|------|
| 127 | Real-time updates: quote_created, quote_updated, quote_deleted broadcast to all clients | Socket.IO events | [ ] |
| 128 | Dashboard + quote list auto-refresh on socket events | `socket.on(...)` | [ ] |
| 129 | Companies auto-refresh on socket events | `socket.on('quote_updated')` | [ ] |
| 130 | **NEW** Sanctum token auth (replaces session cookie) | stack decision | [x] |
| 131 | **NEW** Proper SECRET_KEY / APP_KEY from env (no hardcoded default) | security fix | [x] |
| 132 | **NEW** Groq key in env only, never committed | security fix (V1 leaked key) | [x] |
| 133 | **NEW** Strong seeded passwords (random or env-set, not admin123) | security fix | [x] |
| 134 | **NEW** MySQL with proper migrations (not SQLite) | stack decision | [x] |
| 135 | Constants API endpoint (statuses, sales_reps, quote_sources, roles) | `GET /api/constants` | [x] |
| 136 | Company logo settings endpoint (GET/POST) | `GET/POST /api/settings/logo` | [x] |

---

## V3 New Wins (non-V1)

| # | Feature | Done |
|---|---------|------|
| N1 | Multi-item quotes: `quote_items` 1â†’N per quote | [ ] |
| N2 | Server-side PDF via Gotenberg (not screenshot) | [ ] |
| N3 | Editor state always persisted + restored (V2 #1 bug fix) | [ ] |
| N4 | Customer artwork adjustable + persisted size/pos/rotation | [ ] |

---

## Sign Type Catalog (must match V1 exactly â€” 29 types)

These must appear verbatim in the React catalog and AI prompt:

1. FACE LIT CHANNEL LETTERS
2. FACE LIT CHANNEL LETTERS WITH RACEWAY
3. FACE LIT CHANNEL LETTERS WITH BACKER
4. FACE LIT CHANNEL LETTERS WITH ACM BACKER
5. HALO LIT CHANNEL LETTERS
6. HALO LIT CHANNEL LETTERS WITH RACEWAY
7. HALO LIT CHANNEL LETTERS WITH BACKER
8. HALO LIT CHANNEL LETTERS WITH ACM BACKER
9. FACE AND HALO LIT CHANNEL LETTERS
10. FACE & HALO LIT CHANNEL LETTERS WITH BACKER
11. FACE & HALO LIT CHANNEL LETTERS WITH ACM BACKER & RACEWAY
12. FACE & HALO LIT CHANNEL LETTERS ON FLAT ALUMINUM BACKER & RACEWAY
13. FACE LIT & HALO LIT CHANNEL LETTERS & LOGO ON ROUTED BACKER & RACEWAY AND PILL BOX
14. FACE & HALO LIT CABINET
15. MARQUEE CHANNEL LETTERS
16. 1/4" FLAT CUT ALUMINUM LETTERS
17. 1/2" FLAT CUT ALUMINUM LETTERS
18. 1/4" FLAT CUT ACRYLIC LETTERS
19. 1/2" FLAT CUT ACRYLIC LETTERS
20. LED NEON SIGN (WALL MOUNTED)
21. LED NEON SIGN (SUSPENDED FROM CEILING)
22. OPEN FACE CHANNEL LETTER WITH FAUX NEON
23. OPEN FACE CHANNEL LETTER WITH FAUX NEON ON RACEWAY
24. PUSH THRU ILLUMINATED CABINET (SINGLE SIDED)
25. PUSH THRU ILLUMINATED CABINET WITH HALO LIT BACK
26. DOUBLE SIDED PUSH THRU ILLUMINATED CABINET
27. SINGLE SIDED ILLUMINATED CABINET
28. DOUBLE SIDED ILLUMINATED CABINET
29. SINGLE SIDED ROUTED & BACKED UP ACRYLIC CABINET

---

## Status Options (10 fixed â€” must be exact)

1. To Do
2. In Progress
3. Artwork Needed
4. Quote Approval Needed
5. Need Payment Link Sent
6. Need To Share With Customer
7. Awaiting Customer Response
8. Awaiting Rod Response
9. Awaiting Sir Sami Response
10. Done
