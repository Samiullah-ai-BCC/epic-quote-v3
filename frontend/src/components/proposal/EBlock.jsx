import { useEffect, useRef } from 'react'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

// Editable block: content is written ONCE on mount, imperatively — never through props.
// (Passing dangerouslySetInnerHTML makes React re-apply the ORIGINAL html on every re-render,
// erasing whatever the user typed the moment anything else updates — e.g. the "Saved" toast.)
// A paste event that carries an image (files, or an image/* clipboard item).
const pasteHasImage = (e) => {
  const dt = e.clipboardData || e.dataTransfer
  if (!dt) return false
  if (dt.files && dt.files.length && [...dt.files].some((f) => f.type.startsWith('image/'))) return true
  if (dt.items && [...dt.items].some((it) => it.kind === 'file' && it.type.startsWith('image/'))) return true
  return false
}

export default function EBlock({ k, html, style, noPaste, noImagePaste, readOnly }) {
  const ref = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    // sanitize before it touches the DOM — block content is untrusted (hand-edited + server round-trip)
    if (first.current && ref.current) { ref.current.innerHTML = sanitizeHtml(html); first.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // noPaste: block ALL paste (spec text — sensitive). noImagePaste: block only IMAGE paste/drop
  // (additional notes — text is fine, pasted images are not). Both also block image drops.
  const onPaste = (e) => { if (noPaste || (noImagePaste && pasteHasImage(e))) e.preventDefault() }
  const onDrop = (e) => { if (noPaste || (noImagePaste && pasteHasImage(e))) e.preventDefault() }
  return (
    <div ref={ref} data-key={k} contentEditable={!readOnly} suppressContentEditableWarning
      onPaste={(noPaste || noImagePaste) ? onPaste : undefined}
      onDrop={(noPaste || noImagePaste) ? onDrop : undefined}
      title={readOnly ? 'Follows the price on the Specifications step — not directly editable' : undefined}
      spellCheck lang="en-US" style={{ outline: 'none', ...(readOnly ? { cursor: 'default' } : {}), ...style }} />
  )
}
