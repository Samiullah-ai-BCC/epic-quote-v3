import { ColumnPicker } from '../grid'

// The All Quotes toolbar: search + status/source filters, "mine"/"rush" toggles,
// CSV/Copy export and the admin status-manager opener.
export default function QuoteFilters({
  search, setSearch, status, setStatus, mine, setMine, rushOnly, setRushOnly,
  sourceF, setSourceF, statuses, sources, admin, columns,
  onExportCsv, onCopyRows, onManageStatuses,
}) {
  return (
    <div className="toolbar">
      <input className="grow" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="__pending__">Pending (not Done)</option>
        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap" title="Only quotes assigned to me">
        <input type="checkbox" className="w-auto" checked={mine} onChange={(e) => setMine(e.target.checked)} />
        My quotes
      </label>
      <select className="w-auto" value={sourceF} onChange={(e) => setSourceF(e.target.value)} title="Filter by where the quote came from">
        <option value="">All sources</option>
        {sources.map((qs) => <option key={qs} value={qs}>{qs}</option>)}
      </select>
      <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap" title="Only Rush / Super Rush quotes">
        <input type="checkbox" className="w-auto" checked={rushOnly} onChange={(e) => setRushOnly(e.target.checked)} />
        Rush only
      </label>
      <button className="ghost sm" title="Download the current view (or just the ticked rows) as a spreadsheet file" onClick={onExportCsv}>⬇ CSV</button>
      <button className="ghost sm" title="Copy the current view (or just the ticked rows) — paste into Excel/Google Sheets" onClick={onCopyRows}>⧉ Copy</button>
      {admin && <button className="ghost sm" title="Add, rename, reorder or remove the pickable quote statuses" onClick={onManageStatuses}>⚙ Statuses</button>}
      <ColumnPicker columns={columns} />
    </div>
  )
}
