import { fileUrl } from '../../api/client'
import EditCell from './EditCell'

// One grid row. All mutations flow up through the handler props so the page
// stays the single owner of the react-query mutations.
export default function QuoteRow({
  q, i, columns, statuses, reps, team, admin, readOnly, selected,
  patch, pasteDown, updateStatus, updateTags,
  onToggleSel, onView, onEdit, onHistory, onDelete, onArt,
}) {
  return (
    <tr className={selected ? 'bg-[rgba(249,166,0,0.07)]' : undefined}>
      <td>{!readOnly && <input type="checkbox" checked={selected} className="w-auto" onChange={() => onToggleSel(q.quote_id)} />}</td>
      <td className="muted text-[11px]">{i + 1}</td>
      <td><b>{q.quote_id}</b>{q.is_test && <span className="pill pill-amber ml-1.5 text-[10px]">TEST</span>}{q.rush === 'Super Rush' && <span className="pill pill-coral ml-1.5 text-[10px]">SUPER RUSH</span>}{q.rush === 'Rush' && <span className="pill pill-amber ml-1.5 text-[10px]">RUSH</span>}</td>
      {columns.has('company') && <td><EditCell readOnly={readOnly} col="company" row={i} onPasteDown={pasteDown('company', i)} value={q.company_name} onCommit={(v) => patch(q.quote_id, 'company_name', v)} width={140} /></td>}
      {columns.has('client') && <td><EditCell readOnly={readOnly} col="client" row={i} onPasteDown={pasteDown('client', i)} value={q.client_name} onCommit={(v) => patch(q.quote_id, 'client_name', v)} /></td>}
      {/* CONTACT = one merged line, email first (matches the proposal's own CONTACT line) */}
      {columns.has('contact') && <td><EditCell readOnly={readOnly} col="contact" row={i} onPasteDown={pasteDown('contact', i)} value={q.email || q.contact} onCommit={(v) => patch(q.quote_id, 'contact', v)} /></td>}
      {columns.has('job') && <td><EditCell readOnly={readOnly} col="job" row={i} onPasteDown={pasteDown('job', i)} value={q.job_name} onCommit={(v) => patch(q.quote_id, 'job_name', v)} /></td>}
      {columns.has('price') && <td><EditCell money readOnly={readOnly} col="price" row={i} onPasteDown={pasteDown('price', i)} value={q.price ?? ''} width={100} onCommit={(v) => patch(q.quote_id, 'price', v)} /></td>}
      {columns.has('be') && <td><EditCell money readOnly={readOnly} col="bep" row={i} onPasteDown={pasteDown('bep', i)} value={q.breakeven_production ?? ''} width={90} onCommit={(v) => patch(q.quote_id, 'breakeven_production', v)} /></td>}
      {columns.has('be') && <td><EditCell money readOnly={readOnly} col="bes" row={i} onPasteDown={pasteDown('bes', i)} value={q.breakeven_shipping ?? ''} width={90} onCommit={(v) => patch(q.quote_id, 'breakeven_shipping', v)} /></td>}
      {columns.has('profit') && <td className={'whitespace-nowrap font-semibold' + (q.profit == null ? '' : q.profit >= 0 ? ' text-[#97c459]' : ' text-[#e5484d]')}>
        {q.profit == null ? '—' : `$${Number(q.profit).toLocaleString()} (${q.profit_pct}%)`}
      </td>}
      {columns.has('rep') && <td>
        {admin ? (
          <select value={q.sales_rep || ''} className="w-[110px]" title="Sales rep — N/A makes it a shared quote" onChange={(e) => patch(q.quote_id, 'sales_rep', e.target.value)}>
            <option value="">— N/A —</option>
            {reps.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (q.sales_rep || '—')}
      </td>}
      {columns.has('assigned') && <td>
        <select disabled={readOnly} value={q.assigned_to || ''} className="w-[110px]" title="Who is working this quote" onChange={(e) => patch(q.quote_id, 'assigned_to', e.target.value)}>
          <option value="">—</option>
          {team.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>}
      {columns.has('rush') && <td>
        <select disabled={readOnly} value={q.rush || ''}
          className={'w-[100px]' + (q.rush === 'Super Rush' ? ' border-[#e5484d] font-bold text-[#e5484d]' : q.rush === 'Rush' ? ' border-[#f9a600] font-semibold text-[#f9a600]' : '')}
          title="Rush level — rush quotes jump the needs-attention queue" onChange={(e) => patch(q.quote_id, 'rush', e.target.value)}>
          <option value="">—</option>
          <option value="Rush">Rush</option>
          <option value="Super Rush">Super Rush</option>
        </select>
      </td>}
      {columns.has('approval') && <td className="whitespace-nowrap">
        <label title={q.price_approved ? `Approved by ${q.approved_by}${q.approved_at ? ' on ' + new Date(q.approved_at).toLocaleDateString() : ''}` : 'Tick to approve the price (you + date are logged)'} className="cursor-pointer">
          <input type="checkbox" disabled={readOnly} checked={!!q.price_approved} className="w-auto" onChange={(e) => patch(q.quote_id, 'price_approved', e.target.checked)} /> ✓
        </label>{' '}
        <label title={q.approval_locked ? 'LOCKED — PDF/PNG/payment link blocked until the price is approved. Click to unlock.' : 'Lock this quote until the price is approved'} className={'cursor-pointer' + (q.approval_locked ? '' : ' opacity-50')}>
          <input type="checkbox" disabled={readOnly} checked={!!q.approval_locked} className="w-auto" onChange={(e) => patch(q.quote_id, 'approval_locked', e.target.checked)} /> 🔒
        </label>
      </td>}
      {columns.has('order') && <td className="text-center">
        <label title={q.order_confirmed ? `Order placed${q.order_placed_at ? ' on ' + new Date(q.order_placed_at).toLocaleDateString() : ''}` : 'Tick when the customer places the order (date is stamped)'} className="cursor-pointer">
          <input type="checkbox" disabled={readOnly} checked={!!q.order_confirmed} className="w-auto" onChange={(e) => patch(q.quote_id, 'order_confirmed', e.target.checked)} /> 📦
        </label>
      </td>}
      <td>
        <select disabled={readOnly} value={q.status} className="w-[150px]" onChange={(e) => updateStatus.mutate({ id: q.quote_id, status: e.target.value })}>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* extra "also waiting on…" chips — a quote can wait on several people at once.
            The main status drives the numbers; chips add visibility. */}
        <div className="mt-1 flex max-w-[190px] flex-wrap items-center gap-1">
          {(q.tags || []).map((t) => (
            <span key={t} className="pill pill-purple cursor-pointer text-[10px]" title="Click to remove"
              onClick={() => updateTags.mutate({ id: q.quote_id, tags: (q.tags || []).filter((x) => x !== t) })}>
              {t} ×
            </span>
          ))}
          <select disabled={readOnly} value="" className="h-5 w-[26px] px-0.5 py-0 text-[11px]" title="Also waiting on…"
            onChange={(e) => { const t = e.target.value; if (t) updateTags.mutate({ id: q.quote_id, tags: [...new Set([...(q.tags || []), t])] }) }}>
            <option value="">+</option>
            {statuses.filter((s) => s !== q.status && s !== 'Done' && !(q.tags || []).includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </td>
      {columns.has('files') && <td className="whitespace-nowrap">
        {q.customer_pdf && <a href={fileUrl(q.customer_pdf)} target="_blank" rel="noreferrer">PDF</a>}{' '}
        {/* Art opens a carousel of ALL the quote's images (every sign's artwork +
            customer file + crunched), not just the first one (#15) */}
        {(q.artwork_url || q.customer_pdf || q.crunched_artwork) && (
          <button className="ghost sm px-[7px] py-px" onClick={() => onArt(q)}>Art</button>
        )}{' '}
        {q.crunched_artwork && <a href={fileUrl(q.crunched_artwork)} target="_blank" rel="noreferrer">Crunch</a>}
      </td>}
      <td className="whitespace-nowrap">
        <button className="ghost sm" onClick={() => onView(q)}>View</button>{' '}
        {!readOnly && <><button className="ghost sm" onClick={() => onEdit(q)}>Edit</button>{' '}</>}
        {admin && <><button className="ghost sm" title="Field-level change history (who changed what, when)" onClick={() => onHistory(q.quote_id)}>History</button>{' '}</>}
        {/* Test-flag toggle removed from the UI for now (Sami, 2026-07-14) — the
            is_test field and its KPI exclusion stay intact server-side. */}
        {admin && <button className="danger sm" onClick={() => onDelete(q)}>Delete</button>}
      </td>
    </tr>
  )
}
