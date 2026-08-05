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
  { key: 'actions', always: true, def: 250 },   // real floor is computed per role — see actionsMin

]

export default function QuotesTable({
  sort, columns, statuses, reps, team, admin, readOnly, canApprove,
  selected, allVisibleSelected, onToggleAll, onToggleSel,
  patch, pasteDown, updateStatus, updateTags,
  onView, onEdit, onHistory, onDelete, onArt, isEmpty, canHide, hidden, onHide, onUnhide,
}) {
  const { widths, setWidth } = useColumnWidths()
  const visible = COLS.filter((c) => c.always || columns.has(c.show))
  // THE ACTIONS COLUMN MAY NEVER CLIP ITS OWN BUTTONS. Cells in this grid are
  // `overflow:hidden; text-overflow:ellipsis`, which is right for text and wrong for controls: at
  // the 250px default an admin row measured View 53 + Edit 47 + History 67 + Delete 60 + gaps =
  // 271px, so DELETE was silently replaced by an "…" and admins reported the button as missing.
  // It was never removed from the markup — it was cut off by ten pixels of column.
  // The floor is per-role because the row renders a different set of buttons for each: View is
  // always there, Edit unless the grid is read-only, History and Delete for admins only. A flat
  // floor would leave a rep staring at 150px of empty pinned column.
  const actionsMin = 100 + (readOnly ? 0 : 52) + (admin ? 133 : 0) + (canHide ? 62 : 0)
  const widthOf = (c) => {
    const w = widths[c.key] ?? c.def
    return c.key === 'actions' ? Math.max(w, actionsMin) : w
  }
  // The table is given the EXACT sum of its columns. Left to `max-content` the browser computes
  // a wider intrinsic size (buttons and nowrap headers push it out), then spreads the surplus
  // across every column — so a column dragged to 70px rendered at 122px and no narrow width
  // ever stuck. An explicit total means each <col> gets precisely what it asked for.
  const totalWidth = visible.reduce((n, c) => n + widthOf(c), 0)

  return (
    <div className="grid-wrap overflow-auto">
      {/* `resizable-grid` switches this table to table-layout:fixed, which is what makes a
          dragged width actually stick — under the default `auto` the browser re-measures from
          cell content and quietly ignores the width it was given. */}
      <table className="resizable-grid" style={{ width: totalWidth }}>
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
                  className={c.key === 'actions' ? 'col-pinned-right' : undefined}
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
              admin={admin} readOnly={readOnly} canApprove={canApprove} selected={selected.has(q.quote_id)}
              patch={patch} pasteDown={pasteDown} updateStatus={updateStatus} updateTags={updateTags}
              onToggleSel={onToggleSel} onView={onView} onEdit={onEdit}
              onHistory={onHistory} onDelete={onDelete} onArt={onArt}
              canHide={canHide} hidden={hidden} onHide={onHide} onUnhide={onUnhide} />
          ))}
          {isEmpty && <tr><td colSpan={visible.length} className="center">No quotes found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
