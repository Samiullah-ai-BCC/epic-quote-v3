import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import client from '../api/client'
import KpiTile from '../components/ui/KpiTile'
import EmptyState from '../components/ui/EmptyState'
import { stagger, rise } from '../components/ui/motion'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../components/ui/table'
import PaymentLinkRow from '../components/payments/PaymentLinkRow'

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
        <Input className="grow" placeholder="Search title / company / email / phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="center">Loading…</div> : links.length === 0 ? (
        <motion.div className="panel" variants={rise} initial="hidden" animate="show">
          <EmptyState title="No payment links yet" hint="Links you generate from a proposal will appear here with their paid status." />
        </motion.div>
      ) : (
        <motion.div className="panel table-card overflow-auto" variants={rise} initial="hidden" animate="show">
          <Table className="num-table">
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead><TableHead>Quote</TableHead><TableHead>Title</TableHead><TableHead>Company</TableHead>
                <TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Sent to</TableHead><TableHead>Status</TableHead><TableHead>Link</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((l) => (
                <PaymentLinkRow key={l.id} link={l}
                  onPreview={setPreview}
                  onSetStatus={(status) => setStatusMut.mutate({ id: l.id, status })} />
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {preview && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
          <motion.div className="modal max-w-[min(700px,96%)]"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
            <img src={preview} alt="payment link preview" className="w-full rounded-lg" />
            <div className="foot"><Button onClick={() => setPreview(null)}>Close</Button></div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
