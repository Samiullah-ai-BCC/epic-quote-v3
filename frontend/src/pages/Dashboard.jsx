import { useState } from 'react'
import { useDashboard, useQuotes, useConstants } from '../hooks'
import QuoteCard from '../components/QuoteCard'
import AddQuoteModal from '../components/AddQuoteModal'

export default function Dashboard() {
  const { data: dash } = useDashboard()
  const { data: constants } = useConstants()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const params = {}
  if (search) params.search = search
  if (status) params.status = status
  const { data: quotes = [], isLoading } = useQuotes(params)

  const cards = dash?.cards || {}
  const statuses = constants?.statuses || []

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <button onClick={() => setShowAdd(true)}>+ Add Quote</button>
      </div>

      {dash && (
        <div className="totals">
          <div className="box"><div className="v">{dash.totals.total_quotes_month}</div><div className="k">Quotes ({dash.month_label})</div></div>
          <div className="box"><div className="v">${Number(dash.totals.total_amount_month).toLocaleString()}</div><div className="k">Total Amount (month)</div></div>
          <div className="box"><div className="v">{dash.reports.pending_count}</div><div className="k">Pending</div></div>
          <div className="box"><div className="v">{dash.reports.conversion_rate}%</div><div className="k">Conversion</div></div>
        </div>
      )}

      <div className="cards">
        {statuses.map((s) => (
          <div
            key={s}
            className={'stat' + (status === s ? ' active' : '')}
            onClick={() => setStatus(status === s ? '' : s)}
          >
            <div className="num">{cards[s] ?? 0}</div>
            <div className="lbl">{s}</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <input
          className="grow"
          placeholder="Search quote ID, company, job, client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All statuses</option>
          <option value="__pending__">Pending (not Done)</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="center">Loading…</div>
      ) : quotes.length === 0 ? (
        <div className="center">No quotes found.</div>
      ) : (
        <div className="quote-grid">
          {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
        </div>
      )}

      {showAdd && <AddQuoteModal onClose={() => setShowAdd(false)} />}
    </>
  )
}
