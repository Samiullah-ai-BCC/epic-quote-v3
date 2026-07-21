import { useEffect, useRef } from 'react'

// Editable table cell for quantities / prices / descriptions on item rows: content written once
// (uncontrolled, like EBlock) so autosave re-renders never clobber typing; commits on blur.
export default function EditCell({ value, onCommit, style }) {
  const ref = useRef(null)
  const first = useRef(true)
  useEffect(() => { if (first.current && ref.current) { ref.current.innerText = String(value ?? ''); first.current = false } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // follow an EXTERNAL value change (e.g. qty normalized after commit) — never while focused
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerText !== String(value ?? '')) el.innerText = String(value ?? '')
  }, [value])
  return (
    <div ref={ref} contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => onCommit(e.target.innerText.trim())} style={{ outline: 'none', ...style }} />
  )
}
