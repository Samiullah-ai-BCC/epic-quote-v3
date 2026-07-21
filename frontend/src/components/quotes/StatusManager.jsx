import { useState } from 'react'
import client from '../../api/client'

// Admin status manager (#16): add / rename / remove / reorder the pickable quote statuses.
// Existing quotes keep whatever status string they already carry; "Done" is protected server-side.
export default function StatusManager({ statuses, onClose, onSaved }) {
  const [list, setList] = useState(statuses)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const move = (i, d) => setList((l) => {
    const n = [...l]; const j = i + d
    if (j < 0 || j >= n.length) return l
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  })
  const save = async () => {
    setSaving(true); setErr('')
    try {
      await client.put('/settings/statuses', { statuses: list.map((s) => s.trim()).filter(Boolean) })
      onSaved()
      onClose()
    } catch (e) { setErr(e?.response?.data?.error || 'Could not save statuses.') }
    finally { setSaving(false) }
  }
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal w-[460px]">
        <h2 className="mt-0">Manage statuses</h2>
        <p className="muted text-[12.5px]">Renames/removals never touch existing quotes — they keep their current status. “Done” can’t be removed (reports key off it).</p>
        {err && <p className="err">{err}</p>}
        <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {list.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className="flex-1" value={s} onChange={(e) => setList((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
              <button className="ghost sm" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="ghost sm" title="Move down" disabled={i === list.length - 1} onClick={() => move(i, +1)}>↓</button>
              <button className="ghost sm text-[#e05661]" title={s === 'Done' ? '"Done" cannot be removed' : 'Remove'} disabled={s === 'Done'}
                onClick={() => setList((l) => l.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
        <button className="ghost sm mt-2" onClick={() => setList((l) => [...l, ''])}>+ Add status</button>
        <div className="foot mt-3.5">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save statuses'}</button>
        </div>
      </div>
    </div>
  )
}
