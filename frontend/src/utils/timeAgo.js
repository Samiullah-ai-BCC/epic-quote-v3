import { formatDistanceToNowStrict, format, differenceInDays } from 'date-fns'

/* Airtable-style relative time, backed by date-fns:
   "just now", "5 minutes ago", "3 hours ago", "2 days ago".
   Falls back to an absolute date past ~30 days so old rows stay unambiguous. */
export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  if (Date.now() - then.getTime() < 45_000) return 'just now'
  if (differenceInDays(Date.now(), then) >= 30) return format(then, 'MMM d, yyyy')
  return formatDistanceToNowStrict(then, { addSuffix: true })
}

/* Full timestamp for tooltips / hover. */
export function fullTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, 'MMM d, yyyy, hh:mm a')
}
