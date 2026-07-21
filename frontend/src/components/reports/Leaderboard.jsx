import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { useSalesReps } from '../../hooks'
import EmptyState from '../ui/EmptyState'
import { rise, EASE } from '../ui/motion'
import { initials } from './format'

/* ── Rep leaderboard ─────────────────────────────────────────────────────────────────
   Reps ranked by conversion (then wins), with a progress bar relative to the top performer.
   Rows animate into their new order when the window flips 7d ↔ 30d. */
export default function Leaderboard() {
  const { data: reps = [], isLoading } = useSalesReps()
  const [win, setWin] = useState('monthly')   // 'weekly' | 'monthly'

  const ranked = useMemo(() => {
    return reps
      .map((r) => ({ name: r.name, ...(r[win] || {}) }))
      .filter((r) => (r.total_quotes_received || 0) > 0)
      .sort((a, b) => (b.conversion_rate - a.conversion_rate) || (b.quotes_converted - a.quotes_converted))
  }, [reps, win])
  const topRate = Math.max(1, ...ranked.map((r) => r.conversion_rate || 0))

  return (
    <motion.div className="panel" variants={rise} initial="hidden" animate="show">
      <div className="panel-head">
        <b>Rep leaderboard</b>
        <div className="seg">
          <Button variant="ghost" size="sm" className={cn('h-auto', win === 'weekly' && 'on')} onClick={() => setWin('weekly')}>7d</Button>
          <Button variant="ghost" size="sm" className={cn('h-auto', win === 'monthly' && 'on')} onClick={() => setWin('monthly')}>30d</Button>
        </div>
      </div>
      <div className="board">
        {isLoading ? (
          <div className="center p-6">Loading…</div>
        ) : ranked.length === 0 ? (
          <EmptyState title="No rep activity in this window" hint="Received quotes will rank here by conversion." />
        ) : ranked.map((r, i) => (
          <motion.div layout className="board-row" key={r.name}
            transition={{ layout: { duration: 0.4, ease: EASE } }}>
            <div className="board-rank">{i + 1}</div>
            <div className="board-avatar">{initials(r.name)}</div>
            <div className="board-main">
              <div className="board-name">{r.name}</div>
              <div className="board-track">
                <motion.div className="board-fill" initial={{ width: 0 }} animate={{ width: ((r.conversion_rate || 0) / topRate) * 100 + '%' }}
                  transition={{ duration: 0.5, ease: EASE }} />
              </div>
            </div>
            <div className="board-stat"><b>{Math.round(r.conversion_rate)}%</b><span>{r.quotes_converted}/{r.total_quotes_received}</span></div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
