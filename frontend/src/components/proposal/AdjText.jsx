// A TEXT BLOCK that is dragged, resized and typed into, on a proposal-style sheet.
//
// WHY IT IS NOT AdjImg: AdjImg's whole payload is an <img> with a crop window (ix/iy/iw/ih) — the
// gestures exist to frame a bitmap. A text block has no bitmap and no crop; it has content that
// must stay readable at whatever size the box is dragged to. Bending AdjImg to carry both would put
// an `if (isText)` through every branch of the most delicate geometry code in the app, and that code
// is load-bearing for the artwork on every proposal we send.
//
// DUPLICATED-WITH: frontend/src/components/proposal/AdjImg.jsx — keep in sync
// WHY duplicated: the move/resize gesture and the handle chrome are deliberately the same shape, so
// the two element kinds feel identical to a rep. What differs is the payload (bitmap + crop vs.
// editable text + auto-sized font) and that difference runs through the middle of every branch.
// Rule of three: a third placeable kind is when this becomes one abstraction.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// The font is chosen to FILL the box: the rep sizes the block, the text follows. Searched rather
// than computed because wrapping is not a formula — a line breaks or it doesn't, and only the
// browser knows. ~8 halvings from this range lands within a pixel, which is below what anyone can
// see and cheap enough to run on every drag frame.
const FONT_MIN = 6
const FONT_MAX = 160

export default function AdjText({
  rk, lay, onLay, text, onText, scaleRef, selected, onSelect, readOnly = false,
  bounds, constrain = null, align = 'left',
}) {
  const padX = bounds?.padX || 0
  const padTop = bounds?.padTop || 0, padBottom = bounds?.padBottom || 0
  const innerW = bounds ? Math.max(24, bounds.w - padX * 2) : 0
  const innerH = bounds ? Math.max(24, bounds.h - padTop - padBottom) : 0
  const fitBoundsOnly = (b) => {
    if (!bounds) return b
    let { x, y, w, h } = b
    w = Math.min(w, innerW); h = Math.min(h, innerH)
    x = Math.min(Math.max(padX, x), Math.max(padX, padX + innerW - w))
    y = Math.min(Math.max(padTop, y), Math.max(padTop, padTop + innerH - h))
    return { ...b, x, y, w, h }
  }
  const fitBounds = (b) => {
    const clamped = fitBoundsOnly(b)
    return constrain ? constrain(clamped) : clamped
  }

  const [box, setBox] = useState(() => fitBounds({ x: lay.x, y: lay.y, w: lay.w, h: lay.h }))
  const rootRef = useRef(null)
  const bodyRef = useRef(null)
  const draggingRef = useRef(false)
  const editingRef = useRef(false)

  // Follow external geometry (another element pushing this one, a reload) — but never while this
  // block is the one being dragged, or the gesture would fight its own committed state.
  useEffect(() => {
    if (draggingRef.current || !lay) return
    setBox(fitBoundsOnly({ x: lay.x, y: lay.y, w: lay.w, h: lay.h }))
  }, [lay?.x, lay?.y, lay?.w, lay?.h])   // eslint-disable-line react-hooks/exhaustive-deps

  // THE DYNAMIC SIZE. Binary-search the largest font whose text still fits the box, re-run whenever
  // the box or the text changes. Measured on the real node so wrapping, word length and line height
  // are the browser's answer rather than an estimate.
  const [fontSize, setFontSize] = useState(16)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    let lo = FONT_MIN, hi = FONT_MAX, best = FONT_MIN
    const fits = (px) => {
      el.style.fontSize = `${px}px`
      return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1
    }
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid)) { best = mid; lo = mid } else { hi = mid }
    }
    el.style.fontSize = ''
    setFontSize(Math.floor(best * 10) / 10)
  }, [text, box.w, box.h])

  const start = (kind, handle) => (e) => {
    if (readOnly || editingRef.current) return
    e.preventDefault(); e.stopPropagation(); onSelect()
    draggingRef.current = true
    const sx = e.clientX, sy = e.clientY, b0 = { ...box }, sc = scaleRef?.current || 1
    let last = b0
    const move = (ev) => {
      const dx = (ev.clientX - sx) / sc, dy = (ev.clientY - sy) / sc
      if (kind === 'move') {
        const nb = fitBounds({ ...b0, x: Math.round(b0.x + dx), y: Math.round(b0.y + dy) })
        last = nb; setBox(nb); return
      }
      const L = handle.includes('l'), T = handle.includes('t'), R = handle.includes('r'), B = handle.includes('b')
      let w = b0.w, h = b0.h
      if (R) w = b0.w + dx
      if (L) w = b0.w - dx
      if (B) h = b0.h + dy
      if (T) h = b0.h - dy
      w = Math.max(40, Math.round(w)); h = Math.max(24, Math.round(h))
      let x = b0.x, y = b0.y
      if (L) x = Math.round(b0.x + (b0.w - w))
      if (T) y = Math.round(b0.y + (b0.h - h))
      const nb = fitBounds({ ...b0, x, y, w, h })
      last = nb; setBox(nb)
    }
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up)
      draggingRef.current = false
      onLay(last)
    }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }

  const dot = { position: 'absolute', width: 11, height: 11, background: '#fff', border: '1.5px solid #8b5cf6', borderRadius: '50%', zIndex: 60 }
  const corners = {
    tl: { left: -6, top: -6, cursor: 'nwse-resize' }, tr: { right: -6, top: -6, cursor: 'nesw-resize' },
    bl: { left: -6, bottom: -6, cursor: 'nesw-resize' }, br: { right: -6, bottom: -6, cursor: 'nwse-resize' },
  }

  return (
    <div
      ref={rootRef}
      data-rk={rk}
      onMouseDown={readOnly ? undefined : start('move')}
      style={{
        position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
        cursor: readOnly ? 'default' : 'move', zIndex: selected ? 50 : 20,
        outline: selected ? '1px solid #8b5cf6' : 'none',
      }}
    >
      <div
        ref={bodyRef}
        // FIRST CLICK SELECTS, SECOND CLICK TYPES. Editing is only armed once the block is
        // selected: otherwise the first click lands in the text, the caret appears, and the block
        // never gets its handles — you could type into it but never move or resize it. While it is
        // selected the mousedown is swallowed so placing a caret does not start a drag; while it is
        // not, the event bubbles to the frame, which selects and moves it like any other element.
        contentEditable={!readOnly && selected}
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={() => { editingRef.current = true }}
        onMouseDown={(e) => { if (!readOnly && selected) e.stopPropagation() }}
        onBlur={(e) => {
          editingRef.current = false
          const next = e.currentTarget.innerText.replace(/\u00a0/g, ' ')
          if (onText && next !== text) onText(next)
        }}
        style={{
          width: '100%', height: '100%', outline: 'none', overflow: 'hidden',
          fontFamily: 'Roboto, Arial, sans-serif', fontSize, lineHeight: 1.25, color: '#111',
          textAlign: align, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: readOnly ? 'default' : 'text',
        }}
      >
        {text}
      </div>

      {selected && !readOnly && (
        <>
          {Object.entries(corners).map(([k, css]) => (
            <div key={k} className="adj-ui" style={{ ...dot, ...css }} onMouseDown={start('resize', k)} />
          ))}
        </>
      )}
    </div>
  )
}
