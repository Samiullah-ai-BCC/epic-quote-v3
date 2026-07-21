import { Input } from '../ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table'
import { COLOR, money } from './meta'

/* Searchable recent-quotes table; the header doubles as the active status-filter label. */
export default function RecentQuotes({ recent, search, setSearch, status, clearStatus, onOpen, onViewAll }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <b className="ph">{status || 'Recent quotes'}</b>
        <div className="flex items-center gap-3">
          <Input className="dash-search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {status && <span className="muted sm cursor-pointer" onClick={clearStatus}>Clear</span>}
          <span className="link-gold sm" onClick={onViewAll}>View all</span>
        </div>
      </div>
      <Table className="dash-table">
        <TableHeader>
          <TableRow>
            <TableHead>Quote</TableHead><TableHead>Company</TableHead><TableHead>Rep</TableHead>
            <TableHead className="text-right">Value</TableHead><TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="center p-5 text-center">No quotes found.</TableCell></TableRow>
          ) : recent.map((q) => (
            <TableRow key={q.id} className="cursor-pointer" onClick={() => onOpen(q.quote_id)}>
              <TableCell><b>{q.quote_id}</b></TableCell>
              <TableCell>{q.company_name || '—'}</TableCell>
              <TableCell className="muted">{q.sales_rep || '—'}</TableCell>
              <TableCell className="text-right font-semibold">{q.price ? money(q.price) : '—'}</TableCell>
              <TableCell className="text-right"><span className={'pill pill-' + (COLOR[q.status] || 'gray')}>{q.status}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
