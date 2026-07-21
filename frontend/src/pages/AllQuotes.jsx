import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { EASE } from '../components/ui/motion'
import { useQuotes, useConstants, useUpdateQuote, useUpdateStatus, useUpdateTags, useDeleteQuote } from '../hooks'
import { useSelector } from 'react-redux'
import { selectIsAdmin, selectIsViewer } from '../store/authSlice'
import { useSortable, useColumns, downloadCsv, copyTsv } from '../components/grid'
import AddQuoteModal from '../components/AddQuoteModal'
import RevisionHistory from '../components/RevisionHistory'
import ViewProposalImage from '../components/quotes/ViewProposalImage'
import StatusManager from '../components/quotes/StatusManager'
import ArtCarousel from '../components/quotes/ArtCarousel'
import QuoteFilters from '../components/quotes/QuoteFilters'
import BulkActionsBar from '../components/quotes/BulkActionsBar'
import QuotesTable from '../components/quotes/QuotesTable'

export default function AllQuotes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = useSelector(selectIsAdmin)
  const isViewer = useSelector(selectIsViewer)
  const { data: constants } = useConstants()
  const update = useUpdateQuote()
  const updateStatus = useUpdateStatus()
  const updateTags = useUpdateTags()
  const del = useDeleteQuote()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [mine, setMine] = useState(false)
  const [rushOnly, setRushOnly] = useState(false)
  const [sourceF, setSourceF] = useState('')
  const [viewing, setViewing] = useState(null)
  const [artFor, setArtFor] = useState(null)              // #15 — quote whose files carousel is open
  const [managingStatuses, setManagingStatuses] = useState(false)   // #16 — admin status manager open
  const [selected, setSelected] = useState(() => new Set())   // quote_ids ticked for bulk actions
  // the dashboard's "+ New quote" button arrives with state.openNew → open the modal straight away
  const location = useLocation()
  const [showAdd, setShowAdd] = useState(!!location.state?.openNew)
  const [historyFor, setHistoryFor] = useState(null)   // quote_id whose field-level history is open
  useEffect(() => { if (location.state?.openNew) window.history.replaceState({}, '') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [searchParams, setSearchParams] = useSearchParams()
  const assignedF = searchParams.get('assigned') || ''       // drill-down from the Team page

  const params = {}
  if (search) params.search = search
  if (status) params.status = status
  if (mine) params.assigned = 'me'
  else if (assignedF) params.assigned = assignedF
  if (rushOnly) params.rush = '1'
  if (sourceF) params.source = sourceF
  const { data: quotes = [], isLoading } = useQuotes(params)
  const sort = useSortable(quotes)
  // Grid v2: hideable columns (choice remembered per browser)
  const columns = useColumns('aq_cols', [
    { key: 'company', label: 'Company' }, { key: 'client', label: 'Client' }, { key: 'contact', label: 'Contact' },
    { key: 'job', label: 'Job' }, { key: 'price', label: 'Price' }, { key: 'be', label: 'Breakevens' },
    { key: 'profit', label: 'Profit' }, { key: 'rep', label: 'Sales Rep' }, { key: 'assigned', label: 'Assigned' },
    { key: 'rush', label: 'Rush' }, { key: 'approval', label: 'Approval' }, { key: 'order', label: 'Order' },
    { key: 'files', label: 'Files' },
  ])

  const statuses = constants?.statuses || []
  const reps = constants?.sales_reps || []
  const team = constants?.team || []
  const admin = isAdmin
  const readOnly = isViewer   // viewer accounts: the grid becomes a pure report

  const patch = (id, field, value) => update.mutate({ id, patch: { [field]: value } })

  const remove = (q) => {
    if (window.confirm(`Delete quote ${q.quote_id}? This cannot be undone.`)) del.mutate(q.quote_id)
  }

  // ---- Grid v3: multi-select + bulk actions ----
  const toggleSel = (id) => setSelected((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allVisibleSelected = quotes.length > 0 && quotes.every((q) => selected.has(q.quote_id))
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(quotes.map((q) => q.quote_id)))
  const selIds = quotes.filter((q) => selected.has(q.quote_id)).map((q) => q.quote_id)
  const bulkStatus = (st) => { if (st) selIds.forEach((id) => updateStatus.mutate({ id, status: st })) }
  const bulkAssign = (name) => selIds.forEach((id) => update.mutate({ id, patch: { assigned_to: name } }))
  // ---- Grid v4: export + copy + paste-down ----
  const EXPORT_COLS = [
    ['Quote ID', (q) => q.quote_id], ['Company', (q) => q.company_name], ['Client', (q) => q.client_name],
    ['Phone', (q) => q.contact], ['Email', (q) => q.email], ['Job', (q) => q.job_name], ['Price', (q) => q.price ?? ''],
    ['Breakeven Production', (q) => q.breakeven_production ?? ''], ['Breakeven Shipping', (q) => q.breakeven_shipping ?? ''],
    ['Profit', (q) => q.profit ?? ''], ['Profit %', (q) => q.profit_pct ?? ''],
    ['Sales Rep', (q) => q.sales_rep], ['Assigned To', (q) => q.assigned_to], ['Rush', (q) => q.rush],
    ['Price Approved', (q) => (q.price_approved ? 'yes' : 'no')], ['Approved By', (q) => q.approved_by],
    ['Order Placed', (q) => (q.order_confirmed ? 'yes' : 'no')], ['Order Date', (q) => q.order_placed_at || ''],
    ['Status', (q) => q.status], ['Source', (q) => q.quote_source],
    ['Revision Notes', (q) => q.revision_notes], ['Important Notes', (q) => q.important_notes], ['Internal Notes', (q) => q.internal_notes],
    ['Created', (q) => q.created_at || ''],
  ]
  const exportRows = () => (selIds.length ? sort.sorted.filter((q) => selected.has(q.quote_id)) : sort.sorted)
  const exportCsv = () => downloadCsv(
    `quotes-${new Date().toISOString().slice(0, 10)}.csv`,
    EXPORT_COLS.map(([h]) => h),
    exportRows().map((q) => EXPORT_COLS.map(([, f]) => f(q)))
  )
  const copyRows = async () => {
    const ok = await copyTsv(EXPORT_COLS.map(([h]) => h), exportRows().map((q) => EXPORT_COLS.map(([, f]) => f(q))))
    window.alert(ok ? `Copied ${exportRows().length} row(s) — paste straight into Excel/Sheets.` : 'Copy failed — your browser blocked clipboard access.')
  }
  // pasting a multi-line clipboard into a cell fills that column downwards (Excel-style)
  const COL_FIELD = { company: 'company_name', client: 'client_name', contact: 'contact', job: 'job_name', price: 'price', bep: 'breakeven_production', bes: 'breakeven_shipping' }
  const pasteDown = (col, startRow) => (values) => {
    const field = COL_FIELD[col]
    if (!field) return
    values.forEach((val, offset) => {
      const target = sort.sorted[startRow + offset]
      if (target) patch(target.quote_id, field, val)
    })
  }

  const bulkDelete = () => {
    if (window.confirm(`Delete ${selIds.length} quote${selIds.length > 1 ? 's' : ''} (${selIds.join(', ')})? This cannot be undone.`)) {
      selIds.forEach((id) => del.mutate(id))
      setSelected(new Set())
    }
  }

  return (
    <div className="fill-page">
      <div className="page-head">
        <div className="flex items-center gap-3">
          <h1>All Quotes</h1>
          {assignedF && (
            <span className="pill pill-purple cursor-pointer" title="Click to clear this filter"
              onClick={() => setSearchParams({})}>assigned to {assignedF} ✕</span>
          )}
        </div>
        {!readOnly && <button onClick={() => setShowAdd(true)}>+ New quote</button>}
      </div>

      <QuoteFilters
        search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        mine={mine} setMine={setMine} rushOnly={rushOnly} setRushOnly={setRushOnly}
        sourceF={sourceF} setSourceF={setSourceF}
        statuses={statuses} sources={constants?.quote_sources || []}
        admin={admin} columns={columns}
        onExportCsv={exportCsv} onCopyRows={copyRows} onManageStatuses={() => setManagingStatuses(true)}
      />

      <BulkActionsBar
        selIds={selIds} statuses={statuses} team={team} admin={admin}
        onBulkStatus={bulkStatus} onBulkAssign={bulkAssign} onBulkDelete={bulkDelete}
        onClear={() => setSelected(new Set())}
      />

      {isLoading ? (
        <div className="center">Loading…</div>
      ) : (
        <QuotesTable
          sort={sort} columns={columns} statuses={statuses} reps={reps} team={team}
          admin={admin} readOnly={readOnly}
          selected={selected} allVisibleSelected={allVisibleSelected}
          onToggleAll={toggleAll} onToggleSel={toggleSel}
          patch={patch} pasteDown={pasteDown} updateStatus={updateStatus} updateTags={updateTags}
          onView={setViewing}
          onEdit={(q) => navigate(`/quotes/${q.quote_id}/generate`, { state: { from: '/quotes' } })}
          onHistory={setHistoryFor} onDelete={remove} onArt={setArtFor}
          isEmpty={quotes.length === 0}
        />
      )}

      {viewing && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setViewing(null)}>
          {/* View = the proposal document, full size, nothing else (#3/#4). The details dump and
              the note lanes were removed by decision (2026-07-15): notes are edited in the Edit
              wizard now. modal-view is the wide variant so the 816px page shows at full scale. */}
          <motion.div className="modal modal-view"
            initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}>
            <h2>Quote {viewing.quote_id}</h2>
            <ViewProposalImage quote={viewing} />
            <div className="foot"><button onClick={() => setViewing(null)}>Close</button></div>
          </motion.div>
        </div>
      )}

      {showAdd && <AddQuoteModal onClose={() => setShowAdd(false)} />}
      {historyFor && <RevisionHistory quoteId={historyFor} onClose={() => setHistoryFor(null)} />}
      {artFor && <ArtCarousel quote={artFor} onClose={() => setArtFor(null)} />}
      {managingStatuses && <StatusManager statuses={statuses} onClose={() => setManagingStatuses(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: ['constants'] })} />}
    </div>
  )
}
