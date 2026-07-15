import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import client, { fileUrl } from '../api/client'
import KpiTile from '../components/ui/KpiTile'
import EmptyState from '../components/ui/EmptyState'
import { stagger, rise } from '../components/ui/motion'

const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const KIND_LABEL = { deposit: '50% Deposit', balance: 'Balance', full: 'Full' }
const STATUS_PILL = { unpaid: 'amber', paid: 'green', void: 'gray' }

/* The private payment-link ledger (#Shopify): every link we've generated, searchable, with
   its identifying snapshot (title, image, company, price, who it went to) and paid status. */
export default function PaymentLinks() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState(null)   // image lightbox

  const params = {}
  if (search) params.search = search
  if (status) params.status = status
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['payment-links', params],
    queryFn: async () => (await client.get('/payment-links', { params })).data,
  })

  const kpis = useMemo(() => {
    const paid = links.filter((l) => l.status === 'paid')
    const unpaid = links.filter((l) => l.status === 'unpaid')
    return {
      total: links.length,
      paid: paid.length,
      paidValue: paid.reduce((a, l) => a + (Number(l.amount) || 0), 0),
      unpaidValue: unpaid.reduce((a, l) => a + (Number(l.amount) || 0), 0),
    }
  }, [links])

  const setStatusMut = useMutation({
    mutationFn: ({ id, status }) => client.put(`/payment-links/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-links'] }),
  })

  return (
    <div className="fill-page">
      <div className="page-head">
        <div><h1>Payment Links</h1><div className="sub">Every Shopify link generated — status, amount, and where it went</div></div>
      </div>

      <motion.div className="kpi-row" variants={stagger} initial="hidden" animate="show">
        <KpiTile label="Total links" value={kpis.total} />
        <KpiTile label="Paid" value={kpis.paid} accent />
        <KpiTile label="Collected" value={kpis.paidValue} format={(v) => '$' + Math.round(v).toLocaleString()} />
        <KpiTile label="Outstanding" value={kpis.unpaidValue} format={(v) => '$' + Math.round(v).toLocaleString()} />
      </motion.div>

      <div className="toolbar">
        <input className="grow" placeholder="Search title / company / email / phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
      </div>

      {isLoading ? <div className="center">Loading…</div> : links.length === 0 ? (
        <motion.div className="panel" variants={rise} initial="hidden" animate="show">
          <EmptyState title="No payment links yet" hint="Links you generate from a proposal will appear here with their paid status." />
        </motion.div>
      ) : (
        <motion.div className="panel table-card" variants={rise} initial="hidden" animate="show" style={{ overflow: 'auto' }}>
          <table className="num-table">
            <thead>
              <tr>
                <th>Image</th><th>Quote</th><th>Title</th><th>Company</th>
                <th>Type</th><th>Amount</th><th>Sent to</th><th>Status</th><th>Link</th><th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.image
                      ? <img src={fileUrl(l.image)} alt="" style={{ width: 46, height: 34, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => setPreview(fileUrl(l.image))} />
                      : <span className="muted">—</span>}
                  </td>
                  <td><b>{l.quote_id || '—'}</b></td>
                  <td style={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.title}>{l.title}</td>
                  <td>{l.company_name || '—'}</td>
                  <td><span className="pill pill-purple" style={{ fontSize: 10 }}>{KIND_LABEL[l.kind] || l.kind}</span></td>
                  <td style={{ fontWeight: 600 }}>{money(l.amount)}</td>
                  <td style={{ fontSize: 12 }}>{l.email || l.contact || '—'}</td>
                  <td>
                    <span className={'pill pill-' + (STATUS_PILL[l.status] || 'gray')}>{l.status}{l.status === 'paid' && l.paid_at ? ' · ' + new Date(l.paid_at).toLocaleDateString() : ''}</span>
                  </td>
                  <td>{l.url ? <a href={l.url} target="_blank" rel="noreferrer">Open ↗</a> : <span className="muted" title="Created before Shopify was connected">pending</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {l.status !== 'paid' && <button className="sm" title="Mark this link paid" onClick={() => setStatusMut.mutate({ id: l.id, status: 'paid' })}>✓ Paid</button>}{' '}
                    {l.status === 'paid' && <button className="ghost sm" onClick={() => setStatusMut.mutate({ id: l.id, status: 'unpaid' })}>Unpay</button>}{' '}
                    {l.status !== 'void' && <button className="ghost sm" title="Void this link" onClick={() => setStatusMut.mutate({ id: l.id, status: 'void' })}>Void</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {preview && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
          <motion.div className="modal" style={{ maxWidth: 'min(700px, 96%)' }}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <img src={preview} alt="payment link preview" style={{ width: '100%', borderRadius: 8 }} />
            <div className="foot"><button onClick={() => setPreview(null)}>Close</button></div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
