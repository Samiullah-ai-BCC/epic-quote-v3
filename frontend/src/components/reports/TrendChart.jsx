import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { rise, EASE } from '../ui/motion'
import { money, pct } from './format'

/* ── Trend chart ─────────────────────────────────────────────────────────────────────
   Grey bars = quotes created, gold line = quotes won that month. Bars grow and the line
   traces itself on load (reduced-motion → instant). Legend toggles a series; hovering a
   column shows the full breakdown. */
export default function TrendChart({ months }) {
  const reduce = useReducedMotion()
  const [show, setShow] = useState({ created: true, won: true })
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  if (!months.length) return null

  const W = 760, H = 190, pad = 8
  const bw = W / months.length
  const max = Math.max(1, ...months.map((m) => Math.max(m.created, m.done)))
  const y = (v) => H - (v / max) * (H - pad)
  const cx = (i) => i * bw + bw / 2
  const wonPath = months.map((m, i) => `${i === 0 ? 'M' : 'L'} ${cx(i).toFixed(1)} ${y(m.done).toFixed(1)}`).join(' ')

  const track = (m) => (e) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setHover({ m, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
  }

  return (
    <motion.div className="panel chart-card" variants={rise} initial="hidden" animate="show">
      <div className="panel-head">
        <b>Month by month</b>
        <div className="legend">
          <Button variant="ghost" size="sm" className={cn('legend-item h-auto', !show.created && 'off')} onClick={() => setShow((s) => ({ ...s, created: !s.created }))}>
            <span className="dot bg-[#aeb7c6]" /> Created
          </Button>
          <Button variant="ghost" size="sm" className={cn('legend-item h-auto', !show.won && 'off')} onClick={() => setShow((s) => ({ ...s, won: !s.won }))}>
            <span className="dot bg-gold" /> Won
          </Button>
        </div>
      </div>
      <div className="chart-body" ref={wrapRef} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="chart-svg" preserveAspectRatio="none">
          {months.map((m, i) => {
            const active = hover?.m?.month === m.month
            const ch = (m.created / max) * (H - pad)
            return (
              <g key={m.month} onMouseEnter={track(m)} onMouseMove={track(m)}>
                <rect x={i * bw} y={0} width={bw} height={H} fill={active ? 'var(--gold-soft)' : 'transparent'} />
                {show.created && (
                  <motion.rect
                    x={i * bw + 7} width={bw - 14} y={H - ch} height={ch} rx="3"
                    fill={active ? '#8a94a6' : '#c2cad6'}
                    style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
                    initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : i * 0.03 }}
                  />
                )}
                <text x={cx(i)} y={H + 16} textAnchor="middle" fontSize="9.5" fill={active ? 'var(--gold)' : 'var(--text-faint)'}>{m.label}</text>
              </g>
            )
          })}
          {show.won && (
            <motion.path
              d={wonPath} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.2 }}
            />
          )}
          {show.won && months.map((m, i) => (
            <motion.circle
              key={m.month} cx={cx(i)} cy={y(m.done)} r={hover?.m?.month === m.month ? 5 : 3.2} fill="var(--gold)" stroke="#fff" strokeWidth="1.5"
              initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.6 + i * 0.03 }}
            />
          ))}
        </svg>
        {hover && (() => {
          const TIP = 168
          const flip = hover.x > hover.w * 0.55
          const left = flip ? Math.max(0, hover.x - TIP - 12) : Math.min(hover.w - TIP, hover.x + 12)
          // dynamic pixel position — must stay an inline style
          return (
            <div className="chart-tip" style={{ left, top: Math.max(0, hover.y - 10) }}>
              <div className="tip-title">{hover.m.label}</div>
              <div className="tip-row"><span>Created</span><b>{hover.m.created}</b></div>
              <div className="tip-row"><span>Quoted value</span><b>{money(hover.m.quoted_value)}</b></div>
              <div className="tip-row"><span>Won</span><b>{hover.m.done}</b></div>
              <div className="tip-row"><span>Won value</span><b>{money(hover.m.done_value)}</b></div>
              <div className="tip-row"><span>Conversion</span><b>{pct(hover.m.conversion)}</b></div>
            </div>
          )
        })()}
      </div>
    </motion.div>
  )
}
