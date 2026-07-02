import { useState } from 'react'
import { useActivity } from '../hooks'

export default function Activity() {
  const { data: logs = [], isLoading } = useActivity()
  // logins are ~70% of the log and drown the real work — hidden by default, one click to show
  const [showLogins, setShowLogins] = useState(false)

  const shown = showLogins ? logs : logs.filter((l) => l.action !== 'login')
  const hiddenCount = logs.length - shown.length

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Activity Log</h1>
        <label className="muted" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showLogins} onChange={(e) => setShowLogins(e.target.checked)} style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Show logins{!showLogins && hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
        </label>
      </div>
      {isLoading ? (
        <div className="center">Loading…</div>
      ) : (
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {shown.map((l, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }} className="muted">{l.at ? new Date(l.at).toLocaleString() : ''}</td>
                <td>{l.user}</td>
                <td><span className="badge">{l.action}</span></td>
                <td>{l.details}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={4} className="center">No activity yet.</td></tr>}
          </tbody>
        </table>
      )}
    </>
  )
}
