import { motion } from 'framer-motion'
import { rise } from '../ui/motion'

const money = (n) => '$' + Number(n || 0).toLocaleString()
const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const ago = (iso) => {
  if (!iso) return 'never'
  const d = Math.floor((Date.now() - new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z')).getTime()) / 86400000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

/* One team-member workload card: live open/value/rush stats, 30-day throughput,
   per-status pills, last activity. Clicking drills into that person's quotes. */
export default function TeamCard({ member: m, onOpen }) {
  return (
    <motion.div className="panel team-card" variants={rise}
      whileHover={{ y: -3 }} transition={{ duration: 0.2 }}
      title={`See every quote assigned to ${m.name}`}
      onClick={onOpen}>
      <div className="team-top">
        <div className="team-id">
          <div className="team-avatar">{initials(m.name)}</div>
          <b>{m.name}</b>
        </div>
        <span className="pill pill-gray text-[10px]">{m.role.replace('_', ' ')}</span>
      </div>
      <div className="team-stats">
        <div><div className="v">{m.assigned_open}</div><div className="k">open assigned</div></div>
        <div><div className="v">{money(m.assigned_value)}</div><div className="k">on their desk</div></div>
        <div><div className={m.assigned_rush ? 'v text-danger' : 'v'}>{m.assigned_rush}</div><div className="k">rush</div></div>
      </div>
      <div className="muted text-xs mt-2.5">
        Done (30d): <b>{m.assigned_done_30d}</b> · Created (30d): <b>{m.created_30d}</b> · Own-rep open: <b>{m.rep_open}</b>
        {m.avg_days_to_done != null && <> · Avg time to Done: <b>{m.avg_days_to_done}d</b></>}
      </div>
      {Object.keys(m.statuses || {}).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(m.statuses).map(([st, c]) => (
            <span key={st} className="pill pill-gray text-[10px]">{st}: {c}</span>
          ))}
        </div>
      )}
      <div className="muted mt-2 text-[11px]">Last active: {ago(m.last_active)}</div>
    </motion.div>
  )
}
