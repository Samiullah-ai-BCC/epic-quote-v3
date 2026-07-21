export const money = (n) => '$' + Math.round(Number(n || 0)).toLocaleString()
export const pct = (n) => (n == null ? '—' : Math.round(n) + '%')

// delta % between the last two entries of a series, or null when there's no meaningful prior
export const lastDelta = (series) => {
  if (series.length < 2) return null
  const prev = series[series.length - 2]
  const last = series[series.length - 1]
  if (!prev) return null
  return Math.round(((last - prev) / prev) * 100)
}

export const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
