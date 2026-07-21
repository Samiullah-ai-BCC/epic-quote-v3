import { TableCell, TableRow } from '../ui/table'
import { Button } from '../ui/button'
import { fileUrl } from '../../api/client'

const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const KIND_LABEL = { deposit: '50% Deposit', balance: 'Balance', full: 'Full' }
const STATUS_PILL = { unpaid: 'amber', paid: 'green', void: 'gray' }

/* One payment link in the ledger: identifying snapshot (image, quote, title,
   company), amount, recipient, paid status, and the mark-paid/unpay/void actions. */
export default function PaymentLinkRow({ link: l, onPreview, onSetStatus }) {
  return (
    <TableRow>
      <TableCell>
        {l.image
          ? <img src={fileUrl(l.image)} alt="" className="h-[34px] w-[46px] cursor-pointer rounded object-cover" onClick={() => onPreview(fileUrl(l.image))} />
          : <span className="muted">—</span>}
      </TableCell>
      <TableCell><b>{l.quote_id || '—'}</b></TableCell>
      <TableCell className="max-w-60 overflow-hidden text-ellipsis whitespace-nowrap" title={l.title}>{l.title}</TableCell>
      <TableCell>{l.company_name || '—'}</TableCell>
      <TableCell><span className="pill pill-purple text-[10px]">{KIND_LABEL[l.kind] || l.kind}</span></TableCell>
      <TableCell className="font-semibold">{money(l.amount)}</TableCell>
      <TableCell className="text-xs">{l.email || l.contact || '—'}</TableCell>
      <TableCell>
        <span className={'pill pill-' + (STATUS_PILL[l.status] || 'gray')}>{l.status}{l.status === 'paid' && l.paid_at ? ' · ' + new Date(l.paid_at).toLocaleDateString() : ''}</span>
      </TableCell>
      <TableCell>{l.url ? <a href={l.url} target="_blank" rel="noreferrer">Open ↗</a> : <span className="muted" title="Created before Shopify was connected">pending</span>}</TableCell>
      <TableCell className="space-x-1.5 whitespace-nowrap">
        {l.status !== 'paid' && <Button size="sm" title="Mark this link paid" onClick={() => onSetStatus('paid')}>✓ Paid</Button>}
        {l.status === 'paid' && <Button variant="ghost" size="sm" onClick={() => onSetStatus('unpaid')}>Unpay</Button>}
        {l.status !== 'void' && <Button variant="ghost" size="sm" title="Void this link" onClick={() => onSetStatus('void')}>Void</Button>}
      </TableCell>
    </TableRow>
  )
}
