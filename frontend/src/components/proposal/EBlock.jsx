import { useEffect, useRef } from 'react'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

// Editable block: content is written ONCE on mount, imperatively — never through props.
// (Passing dangerouslySetInnerHTML makes React re-apply the ORIGINAL html on every re-render,
// erasing whatever the user typed the moment anything else updates — e.g. the "Saved" toast.)

// Does this paste/drop carry a FILE (a screenshot, a dragged image, any attachment)?
// Deliberately ANY file, not just image/*: nothing pasted as a file belongs in a spec line.
const payloadHasFile = (dt) => {
  if (!dt) return false
  if (dt.files && dt.files.length) return true
  if (dt.items && [...dt.items].some((it) => it.kind === 'file')) return true
  return false
}

// Insert plain text at the caret, replacing any selection.
//
// Newlines become <br> because a spec is multi-line and the block renders HTML. Everything else
// goes in as TEXT NODES, and that is what makes this safe: no markup, no styles and no <img> can
// survive the trip, whatever the clipboard actually held.
const insertPlainText = (text) => {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return false
  const range = sel.getRangeAt(0)
  range.deleteContents()

  const frag = document.createDocumentFragment()
  String(text).replace(/\r\n?/g, '\n').split('\n').forEach((line, i) => {
    if (i) frag.appendChild(document.createElement('br'))
    if (line) frag.appendChild(document.createTextNode(line))
  })
  const last = frag.lastChild
  range.insertNode(frag)

  // leave the caret after what was just pasted, so typing continues where the rep expects
  if (last) {
    range.setStartAfter(last)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }
  return true
}

export default function EBlock({ k, html, style, noPaste, textOnlyPaste, noImagePaste, readOnly }) {
  const ref = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    // sanitize before it touches the DOM — block content is untrusted (hand-edited + server round-trip)
    if (first.current && ref.current) { ref.current.innerHTML = sanitizeHtml(html); first.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // PASTE POLICY
  //   noPaste                     — refuse everything (kept for any caller wanting a locked block)
  //   textOnlyPaste / noImagePaste — accept TEXT, refuse files, and strip markup by inserting
  //                                 text nodes
  //
  // SPECIFICATIONS is back on `noPaste` (2026-07-29, owner's call): nothing may be pasted into it
  // at all, by any route, and it is edited from the keyboard only. Typing is untouched — this
  // intercepts paste and drop, not input.
  //
  // The middle ground it replaces (textOnlyPaste) existed because pasted markup on a customer
  // document is a real hazard: pasted HTML is NOT run through sanitizeHtml — only the initial
  // mount is — so taking the clipboard's text/plain sidestepped fonts, colours, tracked-change
  // spans and embedded <img>. That reasoning still applies to every OTHER block, which is why
  // textOnlyPaste stays available rather than being deleted.
  //
  // It closes the same hole on Additional Notes, whose `noImagePaste` only looked for FILES: an
  // image copied from a web page arrives as text/html carrying an <img> tag and went straight
  // through — the exact thing that flag was added to prevent.
  const guarded = noPaste || textOnlyPaste || noImagePaste
  const handle = (e) => {
    if (readOnly) return
    if (noPaste) { e.preventDefault(); return }
    const dt = e.clipboardData || e.dataTransfer
    if (payloadHasFile(dt)) { e.preventDefault(); return }   // images and any other file: refused

    const text = dt?.getData ? (dt.getData('text/plain') || '') : ''
    e.preventDefault()
    if (!text) return                                        // nothing pasteable (e.g. HTML-only)
    if (insertPlainText(text)) {
      // contentEditable edits made from script fire NO input event, and the proposal's autosave,
      // per-block dirty tracking, undo history and colour-chip re-anchoring all hang off 'input'.
      // Without this the pasted text would look right and then quietly never be saved.
      e.currentTarget.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return (
    <div ref={ref} data-key={k} contentEditable={!readOnly} suppressContentEditableWarning
      onPaste={guarded ? handle : undefined}
      onDrop={guarded ? handle : undefined}
      title={readOnly ? 'Follows the price on the Specifications step — not directly editable' : undefined}
      spellCheck lang="en-US" style={{ outline: 'none', ...(readOnly ? { cursor: 'default' } : {}), ...style }} />
  )
}
