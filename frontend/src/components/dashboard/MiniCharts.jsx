/* Tiny inline charts (SVG, real data) shared by the dashboard KPI row. */

function spark(counts, w = 220, h = 52, pad = 5) {
  if (!counts?.length) return null
  const max = Math.max(1, ...counts), min = Math.min(...counts)
  const rng = Math.max(1, max - min)
  const x = (i) => (counts.length > 1 ? pad + (i / (counts.length - 1)) * (w - 2 * pad) : w / 2)
  const y = (v) => h - pad - ((v - min) / rng) * (h - 2 * pad)
  const pts = counts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  return { line: pts.join(' '), area: `M${x(0)},${h} L${pts.join(' L')} L${x(counts.length - 1)},${h} Z`, w, h }
}

export function AreaSpark({ counts, stroke, id }) {
  const s = spark(counts); if (!s) return null
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="none" className="mini">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={stroke} stopOpacity="0.30" /><stop offset="1" stopColor={stroke} stopOpacity="0" />
      </linearGradient></defs>
      <path d={s.area} fill={`url(#${id})`} />
      <polyline points={s.line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function MiniLine({ counts, stroke }) {
  const s = spark(counts, 220, 46); if (!s) return null
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="none" className="mini">
      <polyline points={s.line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function MiniBars({ counts, color }) {
  if (!counts?.length) return null
  const max = Math.max(1, ...counts), n = counts.length, bw = 100 / n
  return (
    <svg viewBox="0 0 100 46" preserveAspectRatio="none" className="mini">
      {counts.map((v, i) => {
        const bh = Math.max(2, (v / max) * 42)
        return <rect key={i} x={i * bw + bw * 0.22} y={46 - bh} width={bw * 0.56} height={bh} rx="1" fill={color} opacity={i === n - 1 ? 1 : 0.5} />
      })}
    </svg>
  )
}

export function Ring({ pct, color }) {
  const r = 20, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(15,23,42,.10)" strokeWidth="6" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))} transform="rotate(-90 26 26)" />
    </svg>
  )
}
