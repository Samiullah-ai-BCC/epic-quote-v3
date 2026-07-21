import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import client from '../api/client'
import KpiTile from '../components/ui/KpiTile'
import { stagger } from '../components/ui/motion'
import TeamCard from '../components/team/TeamCard'

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
            <TeamCard key={m.username} member={m}
              onOpen={() => navigate(`/quotes?assigned=${encodeURIComponent(m.name)}`)} />
          ))}
        </motion.div>
      )}
    </>
  )
}
