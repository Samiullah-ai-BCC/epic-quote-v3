import { ColumnPicker } from '../grid'

// The All Quotes toolbar: search + status/source filters, "mine"/"rush" toggles,
// CSV/Copy export and the admin status-manager opener.
export default function QuoteFilters({
  search, setSearch, status, setStatus, mine, setMine, rushOnly, setRushOnly,
  sourceF, setSourceF, statuses, sources, admin, columns,
  company, setCompany, dateFrom, setDateFrom, dateTo, setDateTo,
  onExportCsv, onCopyRows, onManageStatuses,
}) {
  const dated = dateFrom || dateTo
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
      {/* Company + date-range filters. Company is separate from Search on purpose: a rep can
          pin one customer AND still search within that customer's quotes. */}
      <input className="w-[150px]" placeholder="Company…" value={company}
        onChange={(e) => setCompany(e.target.value)} title="Show only this company's quotes" />
      <label className="flex items-center gap-1 whitespace-nowrap text-xs text-dim" title="Quotes created on or after this date">
        From
        <input type="date" className="w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </label>
      <label className="flex items-center gap-1 whitespace-nowrap text-xs text-dim" title="Quotes created on or before this date (the whole day is included)">
        To
        <input type="date" className="w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </label>
      {dated && (
        <button className="ghost sm" title="Clear the date range" onClick={() => { setDateFrom(''); setDateTo('') }}>✕ Dates</button>
      )}
      <button className="ghost sm" title="Download the current view (or just the ticked rows) as a spreadsheet file" onClick={onExportCsv}>⬇ CSV</button>
      <button className="ghost sm" title="Copy the current view (or just the ticked rows) — paste into Excel/Google Sheets" onClick={onCopyRows}>⧉ Copy</button>
      {admin && <button className="ghost sm" title="Add, rename, reorder or remove the pickable quote statuses" onClick={onManageStatuses}>⚙ Statuses</button>}
      <ColumnPicker columns={columns} />
    </div>
  )
}
