import { useCallback, useEffect, useRef, useState } from 'react'

/* Per-column widths for the quotes grid, remembered across sessions.

   Keyed by COLUMN NAME, never by index: the column picker hides and shows columns, so an
   index-keyed map would hand the "Company" width to whatever column happened to slide into
   that slot. A width the rep dragged has to survive that.

   Persisted to localStorage rather than the server — it is a personal view preference, and
   round-tripping it through the API would make every drag a write. */

const KEY = 'quotes.colwidths.v1'
const MIN = 56          // narrower than this and the header label is unreadable
const MAX = 900

const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}   // corrupt entry must never break the grid — fall back to defaults
  }
}

export default function useColumnWidths() {
  const [widths, setWidths] = useState(load)
  const timer = useRef(0)

  // Debounced write: a drag fires dozens of resize events and localStorage is synchronous.
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(widths)) } catch { /* private mode / quota */ }
    }, 250)
    return () => clearTimeout(timer.current)
  }, [widths])

  const setWidth = useCallback((key, w) => {
    setWidths((prev) => {
      const next = Math.max(MIN, Math.min(MAX, Math.round(w)))
      return prev[key] === next ? prev : { ...prev, [key]: next }
    })
  }, [])

  const resetWidths = useCallback(() => {
    setWidths({})
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  }, [])

  return { widths, setWidth, resetWidths }
}
