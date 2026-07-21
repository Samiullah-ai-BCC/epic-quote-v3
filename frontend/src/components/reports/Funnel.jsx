import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import client from '../../api/client'
import EmptyState from '../ui/EmptyState'
import { rise, EASE } from '../ui/motion'

/* ── Conversion funnel ───────────────────────────────────────────────────────────────
   Created → Priced → Approved → Won, with drop-off % between stages and the biggest leak
   flagged. A day-range toggle scopes the window. */
export default function Funnel() {
  const [days, setDays] = useState(365)
  const { data } = useQuery({
    queryKey: ['reports-funnel', days],
    queryFn: async () => (await client.get('/reports/funnel', { params: { days } })).data,
  })
  const stages = data?.stages || []
  const top = stages[0]?.count || 0
  // find the biggest single drop-off to highlight
  let worst = -1, worstDrop = -1
  for (let i = 1; i < stages.length; i++) {
    const drop = stages[i - 1].count ? 1 - stages[i].count / stages[i - 1].count : 0
    if (drop > worstDrop) { worstDrop = drop; worst = i }
  }

  return (
    <motion.div className="panel" variants={rise} initial="hidden" animate="show">
      <div className="panel-head">
        <b>Pipeline funnel</b>
        <div className="seg">
          {[30, 90, 365].map((d) => (
            <Button key={d} variant="ghost" size="sm" className={cn('h-auto', days === d && 'on')} onClick={() => setDays(d)}>{d === 365 ? '12mo' : d + 'd'}</Button>
          ))}
        </div>
      </div>
      <div className="funnel">
        {top === 0 ? (
          <EmptyState title="No quotes in this window" hint="Widen the range or create a quote to see the pipeline." />
        ) : stages.map((s, i) => {
          const w = top ? Math.max(4, (s.count / top) * 100) : 0
          const drop = i > 0 && stages[i - 1].count ? Math.round((1 - s.count / stages[i - 1].count) * 100) : null
          return (
            <div className="funnel-row" key={s.key}>
              <div className="funnel-meta"><span>{s.label}</span><b>{s.count}</b></div>
              <div className="funnel-track">
                <motion.div className={`funnel-fill ${i === worst ? 'leak' : ''}`}
                  initial={{ width: 0 }} animate={{ width: w + '%' }} transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }} />
              </div>
              {drop != null && <div className={`funnel-drop ${i === worst ? 'leak' : ''}`}>−{drop}%</div>}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
