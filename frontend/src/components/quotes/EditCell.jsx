import { useEffect, useState } from 'react'
import { gridKeyNav } from '../grid'

// clean a currency entry to a plain numeric string (digits + one dot)
const cleanMoney = (s) => {
  let t = String(s).replace(/[^0-9.]/g, '')
  const i = t.indexOf('.')
  if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, 2)
  return t
}
export const fmtMoney = (v) => (v === '' || v == null || isNaN(Number(v)) ? '' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

// Commits on blur only when the value actually changed.
// `money` mode: shows $X,XXX.XX when idle, the plain number while editing, and cleans
// input to digits — so deleting + retyping a price always re-formats itself (#19).
export default function EditCell({ value, onCommit, type = 'text', width = 120, col, row, onPasteDown, readOnly, money }) {
  const [v, setV] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  // follow server updates (bulk paste, another user's edit) — but never clobber active typing
  useEffect(() => { if (!focused) setV(value ?? '') }, [value, focused])
  const commit = () => { setFocused(false); if (String(v) !== String(value ?? '')) onCommit(v) }
  if (readOnly) return <span>{value === null || value === undefined || value === '' ? '—' : (money ? fmtMoney(value) : String(value))}</span>
  const display = money && !focused ? fmtMoney(v) : v
  return (
    <input
      type={money ? 'text' : type}
      inputMode={money ? 'decimal' : undefined}
      value={display}
      style={{ width }}
      data-col={col}
      data-row={row}
      onChange={(e) => setV(money ? cleanMoney(e.target.value) : e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={(e) => (col != null ? gridKeyNav(e, col, row) : e.key === 'Enter' && e.currentTarget.blur())}
      onPaste={(e) => {
        // Excel-style: pasting a multi-line clipboard fills this column downwards, one row per line
        if (!onPasteDown) return
        const text = e.clipboardData.getData('text')
        if (text.includes('\n')) {
          e.preventDefault()
          const values = text.replace(/\r/g, '').split('\n').filter((x, idx, arr) => x !== '' || idx < arr.length - 1)
          setV(values[0] ?? '')
          onPasteDown(values)
        }
      }}
    />
  )
}
