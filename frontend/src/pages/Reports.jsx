import { useSalesReps } from '../hooks'

function StatBlock({ title, s }) {
  return (
    <div className="box" style={{ minWidth: 220 }}>
      <div className="k" style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      <div className="line">Received: <b>{s.total_quotes_received}</b></div>
      <div className="line">Converted: <b>{s.quotes_converted}</b></div>
      <div className="line">Conversion: <b>{s.conversion_rate}%</b></div>
    </div>
  )
}

export default function Reports() {
  const { data: reps = [], isLoading } = useSalesReps()

  return (
    <>
      <div className="page-head"><h1>Sales Reports</h1></div>
      {isLoading ? (
        <div className="center">Loading…</div>
      ) : (
        reps.map((r) => (
          <div key={r.name} style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 10 }}>{r.name}</h3>
            <div className="totals">
              <StatBlock title="This Week" s={r.weekly} />
              <StatBlock title="This Month" s={r.monthly} />
            </div>
          </div>
        ))
      )}
    </>
  )
}
