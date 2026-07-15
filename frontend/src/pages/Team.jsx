import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import client from '../api/client'
import KpiTile from '../components/ui/KpiTile'
import { stagger, rise } from '../components/ui/motion'

const money = (n) => '$' + Number(n || 0).toLocaleString()
const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/* Team transparency (T15): one card per member — live workload, rush load,
   done/created in the last 30 days, last activity. Click a card to drill
   into that person's quotes on All Quotes. */
export default function Team() {
  const navigate = useNavigate()
  const { data: team = [], isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => (await client.get('/team')).data,
  })

  const totals = useMemo(() => ({
    members: team.length,
    open: team.reduce((a, m) => a + (m.assigned_open || 0), 0),
    value: team.reduce((a, m) => a + (m.assigned_value || 0), 0),
    rush: team.reduce((a, m) => a + (m.assigned_rush || 0), 0),
  }), [team])

  const ago = (iso) => {
    if (!iso) return 'never'
    const d = Math.floor((Date.now() - new Date(iso + (iso.includes('Z') || iso.includes('+') ? '' : 'Z')).getTime()) / 86400000)
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Team</h1><div className="sub">Live workload — click a person to see their quotes</div></div>
      </div>

      {!isLoading && team.length > 0 && (
        <motion.div className="kpi-row" variants={stagger} initial="hidden" animate="show">
          <KpiTile label="Team members" value={totals.members} />
          <KpiTile label="Open assigned" value={totals.open} accent />
          <KpiTile label="On their desks" value={totals.value} format={(v) => '$' + Math.round(v).toLocaleString()} />
          <KpiTile label="Rush load" value={totals.rush} />
        </motion.div>
      )}

      {isLoading ? <div className="center">Loading…</div> : (
        <motion.div className="team-grid" variants={stagger} initial="hidden" animate="show">
          {team.map((m) => (
            <motion.div key={m.username} className="panel team-card" variants={rise}
              whileHover={{ y: -3 }} transition={{ duration: 0.2 }}
              title={`See every quote assigned to ${m.name}`}
              onClick={() => navigate(`/quotes?assigned=${encodeURIComponent(m.name)}`)}>
              <div className="team-top">
                <div className="team-id">
                  <div className="team-avatar">{initials(m.name)}</div>
                  <b>{m.name}</b>
                </div>
                <span className="pill pill-gray" style={{ fontSize: 10 }}>{m.role.replace('_', ' ')}</span>
              </div>
              <div className="team-stats">
                <div><div className="v">{m.assigned_open}</div><div className="k">open assigned</div></div>
                <div><div className="v">{money(m.assigned_value)}</div><div className="k">on their desk</div></div>
                <div><div className="v" style={{ color: m.assigned_rush ? 'var(--danger)' : undefined }}>{m.assigned_rush}</div><div className="k">rush</div></div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Done (30d): <b>{m.assigned_done_30d}</b> · Created (30d): <b>{m.created_30d}</b> · Own-rep open: <b>{m.rep_open}</b>
                {m.avg_days_to_done != null && <> · Avg time to Done: <b>{m.avg_days_to_done}d</b></>}
              </div>
              {Object.keys(m.statuses || {}).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {Object.entries(m.statuses).map(([st, c]) => (
                    <span key={st} className="pill pill-gray" style={{ fontSize: 10 }}>{st}: {c}</span>
                  ))}
                </div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Last active: {ago(m.last_active)}</div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  )
}
