import 'react-resizable/css/styles.css'
import QuoteRow from './QuoteRow'
import ResizableTh from './ResizableTh'
import useColumnWidths from './useColumnWidths'

// The quotes grid: sortable, RESIZABLE header + one QuoteRow per quote. Pure presentation —
// sorting, selection and mutations all live on the page and arrive as props.
//
// The header is built from COLS rather than written out as JSX so every column has a stable key
// to hang a width on. THE ORDER HERE IS LOAD-BEARING: it must match the <td> order in QuoteRow
// exactly, or every cell after the difference renders under the wrong heading. `show` is the
// column-picker id (same strings the picker toggles); `always` columns cannot be hidden.
const COLS = [
  { key: 'sel', always: true, def: 42 },
  { key: 'num', always: true, def: 48, label: '#', title: 'Row number' },
  { key: 'quote_id', always: true, def: 120, label: 'Quote ID', sort: 'quote_id' },
  { key: 'company', show: 'company', def: 160, label: 'Company', sort: 'company_name' },
  { key: 'client', show: 'client', def: 140, label: 'Client', sort: 'client_name' },
  { key: 'contact', show: 'contact', def: 150, label: 'Contact' },
  { key: 'job', show: 'job', def: 140, label: 'Job', sort: 'job_name' },
  { key: 'price', show: 'price', def: 110, label: 'Price', sort: 'price' },
  { key: 'beprod', show: 'be', def: 100, label: 'BE Prod', title: 'Breakeven production cost — internal only' },
  { key: 'beship', show: 'be', def: 100, label: 'BE Ship', title: 'Breakeven shipping cost — internal only' },
  { key: 'profit', show: 'profit', def: 100, label: 'Profit', sort: 'profit', title: 'Auto: price minus breakevens — internal only. Click to sort.' },
  { key: 'rep', show: 'rep', def: 140, label: 'Sales Rep', sort: 'sales_rep' },
  { key: 'assigned', show: 'assigned', def: 130, label: 'Assigned', sort: 'assigned_to' },
  { key: 'rush', show: 'rush', def: 110, label: 'Rush', sort: 'rush' },
  { key: 'approval', show: 'approval', def: 105, label: 'Approval', title: 'Price approval: ✓ = approved (who/when logged); 🔒 = locked — cannot send PDF/PNG/payment link until approved' },
  { key: 'order', show: 'order', def: 80, label: 'Order', title: 'Customer placed the order — date is stamped automatically' },
  { key: 'status', always: true, def: 150, label: 'Status', sort: 'status' },
  { key: 'files', show: 'files', def: 110, label: 'Files' },
  { key: 'actions', always: true, def: 250 },
]

export default function QuotesTable({
  sort, columns, statuses, reps, team, admin, readOnly,
  selected, allVisibleSelected, onToggleAll, onToggleSel,
  patch, pasteDown, updateStatus, updateTags,
  onView, onEdit, onHistory, onDelete, onArt, isEmpty,
}) {
  const { widths, setWidth } = useColumnWidths()
  const visible = COLS.filter((c) => c.always || columns.has(c.show))
  const widthOf = (c) => widths[c.key] ?? c.def

  return (
    <div className="grid-wrap overflow-auto">
      {/* `resizable-grid` switches this table to table-layout:fixed, which is what makes a
          dragged width actually stick — under the default `auto` the browser re-measures from
          cell content and quietly ignores the width it was given. */}
      <table className="resizable-grid">
        <colgroup>
          {visible.map((c) => <col key={c.key} style={{ width: widthOf(c) }} />)}
        </colgroup>
        <thead>
          <tr>
            {visible.map((c) => {
              const sortable = !!c.sort
              const active = sortable && sort.sortKey === c.sort
              return (
                <ResizableTh
                  key={c.key}
                  width={widthOf(c)}
                  onResize={(w) => setWidth(c.key, w)}
                  title={c.title || (sortable ? 'Click to sort' : undefined)}
                  onClick={sortable ? () => sort.toggle(c.sort) : undefined}
                  style={sortable ? { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' } : undefined}
                >
                  {c.key === 'sel'
                    ? (!readOnly && <input type="checkbox" checked={allVisibleSelected} title="Select every quote in the current view" className="w-auto" onChange={onToggleAll} />)
                    : <>{c.label}{active ? (sort.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</>}
                </ResizableTh>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sort.sorted.map((q, i) => (
            <QuoteRow key={q.id} q={q} i={i}
              columns={columns} statuses={statuses} reps={reps} team={team}
              admin={admin} readOnly={readOnly} selected={selected.has(q.quote_id)}
              patch={patch} pasteDown={pasteDown} updateStatus={updateStatus} updateTags={updateTags}
              onToggleSel={onToggleSel} onView={onView} onEdit={onEdit}
              onHistory={onHistory} onDelete={onDelete} onArt={onArt} />
          ))}
          {isEmpty && <tr><td colSpan={visible.length} className="center">No quotes found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
