import { motion } from 'framer-motion'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table'
import { rise } from '../ui/motion'
import { money, pct } from './format'

/* ── Detail table ────────────────────────────────────────────────────────────────────
   The exact monthly numbers, tabular figures so columns never jitter, newest first. */
export default function DetailTable({ months }) {
  if (!months.length) return null
  return (
    <motion.div className="panel table-card" variants={rise} initial="hidden" animate="show">
      <div className="panel-head"><b>Monthly detail</b></div>
      <Table className="num-table">
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead><TableHead>Created</TableHead><TableHead>Quoted value</TableHead>
            <TableHead>Won</TableHead><TableHead>Won value</TableHead><TableHead>Conversion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...months].reverse().map((m) => (
            <TableRow key={m.month}>
              <TableCell><b>{m.label}</b></TableCell>
              <TableCell>{m.created}</TableCell>
              <TableCell>{money(m.quoted_value)}</TableCell>
              <TableCell>{m.done}</TableCell>
              <TableCell>{money(m.done_value)}</TableCell>
              <TableCell>{m.conversion == null ? <span className="muted">—</span> : pct(m.conversion)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  )
}
