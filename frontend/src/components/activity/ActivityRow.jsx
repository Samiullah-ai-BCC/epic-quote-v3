import { TableCell, TableRow } from '../ui/table'
import { timeAgo, fullTime } from '../../utils/timeAgo'

const money = (n) => (n > 0 ? '$' + Number(n).toLocaleString() : '—')

/* One quote row in the activity grid: snapshot thumbnail, identity, status,
   price, and its latest tracked change. Clicking opens full version history. */
export default function ActivityRow({ row: r, onOpen }) {
  return (
    <TableRow className="cursor-pointer" onClick={onOpen} title="Open full version history">
      <TableCell className="p-1">
        {r.snapshot_image
          ? <img src={r.snapshot_image} alt="" className="block h-12 w-[38px] rounded border border-line bg-white object-cover object-top" />
          : <div className="grid h-12 w-[38px] place-items-center rounded border border-dashed border-line text-base text-faint">—</div>}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="font-bold">{r.quote_id}</div>
        {r.rev_label && <div className="muted text-[11px]">{r.rev_label}</div>}
      </TableCell>
      <TableCell>
        <div className="font-semibold">{r.company}</div>
        {r.job_name && <div className="muted text-xs">{r.job_name}</div>}
      </TableCell>
      <TableCell><span className="badge">{r.status}</span></TableCell>
      <TableCell className="whitespace-nowrap text-right">{money(r.price)}</TableCell>
      <TableCell className="max-w-80">
        {r.last_change
          ? <span>{r.last_change}{r.change_count > 1 && <span className="muted"> · +{r.change_count - 1} more</span>}</span>
          : <span className="muted">No changes yet</span>}
      </TableCell>
      <TableCell className="whitespace-nowrap">{r.changed_by || <span className="muted">—</span>}</TableCell>
      <TableCell className="muted whitespace-nowrap" title={fullTime(r.changed_at)}>{r.changed_at ? timeAgo(r.changed_at) : '—'}</TableCell>
    </TableRow>
  )
}
