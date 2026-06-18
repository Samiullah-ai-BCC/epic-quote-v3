import { useActivity } from '../hooks'

export default function Activity() {
  const { data: logs = [], isLoading } = useActivity()

  return (
    <>
      <div className="page-head"><h1>Activity Log</h1></div>
      {isLoading ? (
        <div className="center">Loading…</div>
      ) : (
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }} className="muted">{l.at ? new Date(l.at).toLocaleString() : ''}</td>
                <td>{l.user}</td>
                <td><span className="badge">{l.action}</span></td>
                <td>{l.details}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="center">No activity yet.</td></tr>}
          </tbody>
        </table>
      )}
    </>
  )
}
