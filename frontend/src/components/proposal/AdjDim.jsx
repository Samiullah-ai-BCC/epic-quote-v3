import { useEffect, useRef, useState } from 'react'

// Dimension annotation: an arrowed measurement line with an editable size label, shown beside
// the artwork (like a shop drawing). Drag the body to move, pull the end dot to change length,
// click the label to type the size. The line + label print; the purple chrome does not.
export default function AdjDim({ rk, lay, onLay, scaleRef, selected, onSelect, onRemove }) {
  const [d, setD] = useState(lay)
  // Follow EXTERNAL geometry updates (the live "re-hug the artwork" sync writes new x/y/len into
  // layout) — local state used to be initialized once and never re-read, so arrows never moved (#1).
  // Skipped while THIS arrow is being dragged, so the user's own drag is never fought.
  const draggingRef = useRef(false)
  useEffect(() => { if (!draggingRef.current) setD(lay) }, [lay])
  const start = (kind) => (e) => {
    e.preventDefault(); e.stopPropagation(); onSelect()
    draggingRef.current = true
    const sx = e.clientX, sy = e.clientY, d0 = { ...d }, sc = scaleRef.current || 1
    let last = d0   // latest geometry — onLay must never run inside a setD updater (render phase)
    const move = (ev) => {
      const dx = (ev.clientX - sx) / sc, dy = (ev.clientY - sy) / sc
      const nd = kind === 'move'
        ? { ...d0, x: Math.round(d0.x + dx), y: Math.round(d0.y + dy) }
        : { ...d0, len: Math.max(24, Math.round(d0.len + (d0.vert ? dy : dx))) }
      last = nd; setD(nd)
    }
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); draggingRef.current = false; onLay(last) }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }
  const C = '#c0392b'
  const head = { position: 'absolute', width: 0, height: 0 }
  return (
    <div data-rk={rk} onMouseDown={start('move')}
      style={{ position: 'absolute', left: d.x, top: d.y, width: d.vert ? 14 : d.len, height: d.vert ? d.len : 14, cursor: 'move', zIndex: 55 }}>
      {d.vert ? (
        <>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 0, borderLeft: `1.2px solid ${C}` }} />
          <span style={{ ...head, left: '50%', top: 0, marginLeft: -4, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `6px solid ${C}` }} />
          <span style={{ ...head, left: '50%', bottom: 0, marginLeft: -4, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `6px solid ${C}` }} />
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 0, borderTop: `1.2px solid ${C}` }} />
          <span style={{ ...head, top: '50%', left: 0, marginTop: -4, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: `6px solid ${C}` }} />
          <span style={{ ...head, top: '50%', right: 0, marginTop: -4, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${C}` }} />
        </>
      )}
      <span contentEditable suppressContentEditableWarning spellCheck={false}
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={(e) => { const label = e.target.innerText.trim(); const n = { ...d, label }; setD(n); onLay(n) }}
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: '#fff', color: C, fontSize: 9, fontWeight: 700, padding: '0 3px', whiteSpace: 'nowrap', outline: 'none', textTransform: 'none' }}
      >{d.label}</span>
      {selected && (
        <>
          <span className="adj-ui" title="Length" onMouseDown={start('len')}
            style={{ position: 'absolute', ...(d.vert ? { left: '50%', bottom: -6, marginLeft: -5 } : { right: -6, top: '50%', marginTop: -5 }), width: 11, height: 11, background: '#fff', border: '1.5px solid #8b5cf6', borderRadius: '50%', cursor: d.vert ? 'ns-resize' : 'ew-resize', zIndex: 60 }} />
          <span className="adj-ui" title="Remove" onMouseDown={(e) => { e.stopPropagation(); onRemove() }}
            style={{ position: 'absolute', top: -18, right: -6, width: 15, height: 15, background: '#fff', border: '1.5px solid #e05661', borderRadius: '50%', color: '#e05661', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 60 }}>×</span>
        </>
      )}
    </div>
  )
}
