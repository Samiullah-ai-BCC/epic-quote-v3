import { useLayoutEffect, useRef, useState } from 'react'
import { swatchText } from './util'

// Canva-style draggable color swatch: a filled block + name that PRINTS, plus a picker popover
// (color wheel + name field) carrying className "adj-ui" so it is hidden from the PDF/PNG capture.
export default function AdjSwatch({ rk, sw, onChange, onRemove, onPick, canPick, scaleRef, selected, onSelect, onDragEnd, locked }) {
  const startDrag = (e) => {
    if (e.target.closest('.adj-ui')) return            // don't drag while using the picker
    e.preventDefault(); e.stopPropagation(); onSelect()
    if (locked) return                                  // FACE / RETURN&TRIM are auto-anchored, not draggable
    const sx = e.clientX, sy = e.clientY, x0 = sw.x, y0 = sw.y, sc = scaleRef.current || 1
    const move = (ev) => onChange({ ...sw, x: Math.round(x0 + (ev.clientX - sx) / sc), y: Math.round(y0 + (ev.clientY - sy) / sc) })
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); onDragEnd && onDragEnd() }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }
  // Horizontal-only resize from the right edge.
  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation(); onSelect()
    const sx = e.clientX, w0 = sw.w, sc = scaleRef.current || 1
    const move = (ev) => onChange({ ...sw, w: Math.max(28, Math.round(w0 + (ev.clientX - sx) / sc)) })
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }
  // Corner resize — BOTH dimensions, like the artwork image (#3). Left/top corners also move
  // the chip so the opposite corner stays anchored.
  const startCorner = (handle) => (e) => {
    e.preventDefault(); e.stopPropagation(); onSelect()
    const sx = e.clientX, sy = e.clientY, s0 = { ...sw }, sc = scaleRef.current || 1
    const L = handle.includes('l'), T = handle.includes('t')
    const move = (ev) => {
      const dx = (ev.clientX - sx) / sc, dy = (ev.clientY - sy) / sc
      const w = Math.max(28, Math.round(L ? s0.w - dx : s0.w + dx))
      const h = Math.max(12, Math.round(T ? s0.h - dy : s0.h + dy))
      onChange({ ...s0, w, h, x: L ? Math.round(s0.x + (s0.w - w)) : s0.x, y: T ? Math.round(s0.y + (s0.h - h)) : s0.y, moved: true })
    }
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); onDragEnd && onDragEnd() }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }
  const isRGB = sw.color === 'RGB'                     // colour-changing neon (#10)
  const has = !!sw.color
  // RGB fills the swatch like a colour wheel; the label is forced to "RGB CHANGING COLOR".
  const bg = isRGB ? 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' : (has ? sw.color : '#e5e5e5')
  const label = isRGB ? 'RGB CHANGING COLOR' : (sw.name || '')

  // AUTO-FIT THE LABEL. The chip is a fixed box but its text is free-form ("NAVY BLUE",
  // "RGB CHANGING COLOR"), and at a fixed 11px anything long was simply clipped by the chip's
  // overflow:hidden — the rep saw a half-written colour on a document about to be sent.
  // Measure the text at the base size and scale the font down only as far as needed, to a floor
  // that stays readable in print; short labels are untouched and still render at 11px.
  const BASE_FS = 11, MIN_FS = 6
  const boxRef = useRef(null)
  const textRef = useRef(null)
  const [fit, setFit] = useState({ fs: BASE_FS, wrap: false })
  useLayoutEffect(() => {
    const box = boxRef.current, el = textRef.current
    if (!box || !el) return
    const availW = box.clientWidth - 8, availH = box.clientHeight
    if (availW <= 0 || availH <= 0) return

    const measure = (fs, wrap) => {
      el.style.fontSize = fs + 'px'
      el.style.whiteSpace = wrap ? 'normal' : 'nowrap'
      return { w: el.scrollWidth, h: el.scrollHeight }
    }

    // 1. TEXT THAT ALREADY FITS IS LEFT COMPLETELY ALONE — same single line at the same 11px it
    //    has always rendered at. Auto-fit must not quietly restyle every short label ("BLACK")
    //    while fixing the long ones.
    let best = null
    if (measure(BASE_FS, false).w <= availW) {
      best = { fs: BASE_FS, wrap: false }
    } else {
      // 2. Largest single-line size that fits the width.
      for (let fs = BASE_FS - 0.5; fs >= MIN_FS && !best; fs -= 0.5) {
        if (measure(fs, false).w <= availW) best = { fs, wrap: false }
      }
      // 3. Still too wide even at the legible floor -> wrap, and fit the HEIGHT too, or a name
      //    that fits across still runs out the bottom of a 20px chip.
      if (!best) {
        for (let fs = BASE_FS; fs >= MIN_FS && !best; fs -= 0.5) {
          const m = measure(fs, true)
          if (m.w <= availW && m.h <= availH) best = { fs, wrap: true }
        }
      }
      // 4. Genuinely impossible in this box (a very long name in a small chip): show the most
      //    we can at the floor. The chip is resizable — that is the rep's lever, not a smaller font.
      if (!best) best = { fs: MIN_FS, wrap: true }
    }
    el.style.fontSize = ''
    el.style.whiteSpace = ''
    setFit(best)
    // re-run whenever the text OR the chip's box changes — resizing the chip must refit too
  }, [label, sw.w, sw.h])
  const fs = fit.fs

  return (
    <div data-rk={rk} onMouseDown={startDrag}
      style={{ position: 'absolute', left: sw.x, top: sw.y, width: sw.w, height: sw.h, cursor: 'move' }}>
      <div ref={boxRef} style={{ width: '100%', height: '100%', background: bg, color: isRGB ? '#111' : swatchText(bg), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fs, fontWeight: 400, border: '1px solid rgba(0,0,0,0.3)', overflow: 'hidden', padding: '0 4px', boxSizing: 'border-box', textShadow: isRGB ? '0 0 3px rgba(255,255,255,0.9)' : undefined }}>
        <span ref={textRef} style={{ display: 'inline-block', maxWidth: '100%', whiteSpace: fit.wrap ? 'normal' : 'nowrap', overflowWrap: 'anywhere', lineHeight: 1.1, textAlign: 'center' }}>{label}</span>
      </div>
      {selected && (
        <>
          <div className="adj-ui" style={{ position: 'absolute', inset: -2, border: '1.5px solid #8b5cf6', pointerEvents: 'none' }} />
          <span className="adj-ui" onMouseDown={startResize} title="Drag to widen"
            style={{ position: 'absolute', right: -5, top: '50%', marginTop: -8, width: 9, height: 16, background: '#fff', border: '1.5px solid #8b5cf6', borderRadius: 2, cursor: 'ew-resize', zIndex: 71 }} />
          {/* corner handles: resize BOTH dimensions, like the artwork image (#3) */}
          {[['tl', { left: -6, top: -6, cursor: 'nwse-resize' }], ['tr', { right: -6, top: -6, cursor: 'nesw-resize' }],
            ['bl', { left: -6, bottom: -6, cursor: 'nesw-resize' }], ['br', { right: -6, bottom: -6, cursor: 'nwse-resize' }]].map(([c, pos]) => (
            <span key={c} className="adj-ui" title="Resize" onMouseDown={startCorner(c)}
              style={{ position: 'absolute', width: 10, height: 10, background: '#fff', border: '1.5px solid #8b5cf6', borderRadius: '50%', zIndex: 71, ...pos }} />
          ))}
          <div className="adj-ui" onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 70, background: '#fff', border: '1px solid #8b5cf6', borderRadius: 6, padding: 8, display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', textTransform: 'none', width: 246 }}>
            <input type="color" value={isRGB || !has ? '#000000' : sw.color} onChange={(e) => onChange({ ...sw, color: e.target.value })}
              title="Pick color" style={{ width: 34, height: 30, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            {/* RGB colour-changing toggle (#10) — for neon signs whose colour isn't static */}
            <button type="button" onClick={() => onChange({ ...sw, color: isRGB ? '' : 'RGB' })}
              title="RGB colour-changing (neon)"
              style={{ border: isRGB ? '2px solid #8b5cf6' : '1px solid #ccc', borderRadius: 4, cursor: 'pointer', width: 30, height: 30, padding: 0, background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)', fontSize: 0 }}>RGB</button>
            {canPick && (
              <button type="button" onClick={onPick} title="Pick a color from the artwork (works in every browser)"
                style={{ border: '1px solid #ccc', background: '#fff', borderRadius: 4, cursor: 'pointer', padding: '4px 5px', display: 'flex', alignItems: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" /></svg>
              </button>
            )}
            <input type="text" value={sw.name || ''} placeholder="name / PMS" onChange={(e) => onChange({ ...sw, name: e.target.value })}
              style={{ flex: 1, fontSize: 12, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
            <button type="button" onClick={onRemove} title="Remove swatch"
              style={{ border: 'none', background: '#fee', color: '#c00', borderRadius: 4, cursor: 'pointer', fontWeight: 700, padding: '4px 7px' }}>×</button>
          </div>
        </>
      )}
    </div>
  )
}
