import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getActivityFeed } from '../api/quotes'
import RevisionHistory from '../components/RevisionHistory'
import { rise } from '../components/ui/motion'
import { Input } from '../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import ActivityRow from '../components/activity/ActivityRow'

/* Airtable-style activity log: a live grid of EVERY quote with its latest change in the last
   columns (what changed · who · how long ago), newest first. Click any row to open that quote's
   full version history (field diffs + the rendered proposal image at each version). */
export default function Activity() {
  const [search, setSearch] = useState('')
  const [historyFor, setHistoryFor] = useState(null)

  // refetch on an interval so the "x minutes ago" column and new edits stay current
  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: getActivityFeed,
    refetchInterval: 60_000,
    retry: false,
  })
  const errMsg = isError
    ? (error?.response?.status === 404
        ? 'The activity feed endpoint is not live on the server (HTTP 404). The backend needs to be restarted/redeployed with the latest code (and its route cache cleared).'
        : (error?.response?.data?.error || error?.message || 'Could not load the activity feed.'))
    : ''

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.quote_id, r.company, r.job_name, r.assigned_to, r.changed_by, r.last_change]
        .filter(Boolean).some((s) => String(s).toLowerCase().includes(q))
    )
  }, [rows, search])

  const edited = rows.filter((r) => r.changed_at).length

  return (
    <>
      <div className="page-head flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="mb-0.5">Activity Log</h1>
          <div className="muted text-[13px]">{rows.length} quote{rows.length === 1 ? '' : 's'} · {edited} with tracked changes</div>
        </div>
        <Input
          className="w-[260px]"
          placeholder="Search quote, company, person…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {errMsg && (
        <div className="err mb-3.5 rounded-lg px-3.5 py-2.5">
          ⚠ {errMsg}
        </div>
      )}

      {isLoading ? (
        <div className="center">Loading…</div>
      ) : isError ? null : (
        <motion.div variants={rise} initial="hidden" animate="show" className="overflow-x-auto">
          <Table className="grid">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[46px]"></TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Company / Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Latest change</TableHead>
                <TableHead>Changed by</TableHead>
                <TableHead className="whitespace-nowrap">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <ActivityRow key={r.quote_id} row={r} onOpen={() => setHistoryFor(r.quote_id)} />
              ))}
              {shown.length === 0 && <TableRow><TableCell colSpan={8} className="center">No quotes match this search.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {historyFor && <RevisionHistory quoteId={historyFor} onClose={() => setHistoryFor(null)} />}
    </>
  )
}
