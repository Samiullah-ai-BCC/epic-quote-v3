import { SortTh } from '../grid'
import QuoteRow from './QuoteRow'

// The quotes grid: sortable header + one QuoteRow per quote. Pure presentation —
// sorting, selection and mutations all live on the page and arrive as props.
export default function QuotesTable({
  sort, columns, statuses, reps, team, admin, readOnly,
  selected, allVisibleSelected, onToggleAll, onToggleSel,
  patch, pasteDown, updateStatus, updateTags,
  onView, onEdit, onHistory, onDelete, onArt, isEmpty,
}) {
  return (
    <div className="grid-wrap overflow-auto">
      <table>
        <thead>
          <tr>
            <th>{!readOnly && <input type="checkbox" checked={allVisibleSelected} title="Select every quote in the current view" className="w-auto" onChange={onToggleAll} />}</th>
            <th title="Row number">#</th>
            <SortTh k="quote_id" sort={sort}>Quote ID</SortTh>
            {columns.has('company') && <SortTh k="company_name" sort={sort}>Company</SortTh>}
            {columns.has('client') && <SortTh k="client_name" sort={sort}>Client</SortTh>}
            {columns.has('contact') && <th>Contact</th>}
            {columns.has('job') && <SortTh k="job_name" sort={sort}>Job</SortTh>}
            {columns.has('price') && <SortTh k="price" sort={sort}>Price</SortTh>}
            {columns.has('be') && <th title="Breakeven production cost — internal only">BE Prod</th>}
            {columns.has('be') && <th title="Breakeven shipping cost — internal only">BE Ship</th>}
            {columns.has('profit') && <SortTh k="profit" sort={sort} title="Auto: price minus breakevens — internal only. Click to sort.">Profit</SortTh>}
            {columns.has('rep') && <SortTh k="sales_rep" sort={sort}>Sales Rep</SortTh>}
            {columns.has('assigned') && <SortTh k="assigned_to" sort={sort}>Assigned</SortTh>}
            {columns.has('rush') && <SortTh k="rush" sort={sort}>Rush</SortTh>}
            {columns.has('approval') && <th title="Price approval: ✓ = approved (who/when logged); 🔒 = locked — cannot send PDF/PNG/payment link until approved">Approval</th>}
            {columns.has('order') && <th title="Customer placed the order — date is stamped automatically">Order</th>}
            <SortTh k="status" sort={sort}>Status</SortTh>{columns.has('files') && <th>Files</th>}<th></th>
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
          {isEmpty && <tr><td colSpan={19} className="center">No quotes found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
