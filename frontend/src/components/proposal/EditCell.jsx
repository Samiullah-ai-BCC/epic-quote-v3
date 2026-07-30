import { useEffect, useRef } from 'react'

// Editable table cell for quantities / prices / descriptions on item rows: content written once
// (uncontrolled, like EBlock) so autosave re-renders never clobber typing; commits on blur.
// `readOnly` cells still RENDER their value and still follow external updates — they are simply
// not typeable. Used for figures the wizard owns (quantity), which a rep could otherwise retype
// here without the change ever reaching the quote record.
export default function EditCell({ value, onCommit, style, readOnly, readOnlyTitle }) {
  const ref = useRef(null)
  const first = useRef(true)
  useEffect(() => { if (first.current && ref.current) { ref.current.innerText = String(value ?? ''); first.current = false } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // follow an EXTERNAL value change (e.g. qty normalized after commit) — never while focused
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerText !== String(value ?? '')) el.innerText = String(value ?? '')
  }, [value])
  return (
    <div ref={ref} contentEditable={!readOnly} suppressContentEditableWarning spellCheck={false}
      title={readOnly ? (readOnlyTitle || 'Not editable here — change it on the “Edit specs” step') : undefined}
      onBlur={readOnly ? undefined : (e) => onCommit(e.target.innerText.trim())}
      style={{ outline: 'none', ...(readOnly ? { cursor: 'default' } : {}), ...style }} />
  )
}
