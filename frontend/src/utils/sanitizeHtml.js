import DOMPurify from 'dompurify'

/* Strict allow-list HTML sanitizer for the proposal's editable blocks.

   The proposal writes saved block content straight into the DOM with innerHTML
   (EBlock). Block content can be hand-edited on the page AND round-trips through
   the server, so it is UNTRUSTED — a rep could plant `<img onerror=…>` that runs
   in whoever opens the quote next (including an admin).

   This wraps DOMPurify (the maintained, audited standard) instead of a hand-rolled
   DOM walk. The allow-list below is deliberately narrow — only text-formatting tags
   survive; every event handler / script / dangerous URL is dropped by the library. */

const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br', 'p', 'div', 'span', 'font',
  'ul', 'ol', 'li', 'sub', 'sup', 'small', 'big', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr',
]
const ALLOWED_ATTR = ['style', 'align', 'color', 'size', 'face', 'colspan', 'rowspan', 'href', 'target', 'rel']

// A style value is dropped whole if it tries anything active (url(), expression(), @import, js: …).
// DOMPurify's URI filtering already blocks javascript:/data: hrefs; this closes the style vector too.
const STYLE_BLOCKLIST = /(url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding)/i

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.getAttribute && node.getAttribute('style') && STYLE_BLOCKLIST.test(node.getAttribute('style'))) {
    node.removeAttribute('style')
  }
  // links that open a new tab can't reach back into this page
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeHtml(html) {
  if (html == null) return ''
  const str = String(html)
  if (!str) return ''
  return DOMPurify.sanitize(str, { ALLOWED_TAGS, ALLOWED_ATTR })
}
