import { Button } from '../ui/button'
import { IcAlert, IcChevR } from '../icons'
import { COLOR, ACTION, money } from './meta'

/* The urgency list: every quote whose status maps to a rep action, sorted by the API. */
export default function NeedsAttention({ needs, onOpen, onViewAll }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <b className="ph"><span className="ph-ico amber"><IcAlert size={14} /></span> Needs attention</b>
        <span className="muted sm">Sorted by urgency</span>
      </div>
      {needs.length === 0 ? (
        <div className="na-empty">Nothing waiting on you right now. Nice.</div>
      ) : needs.map((q) => {
        const action = ACTION[q.status] || q.status
        const chip = q.days_waiting > 0 ? `${action} · ${q.days_waiting}d` : action
        return (
          <div key={q.quote_id} className="na-row">
            <div className="na-info">
              <div className="na-id">{q.quote_id} · {q.company_name || '—'}</div>
              <div className="na-sub">{q.job_name || ''}{q.assigned_to ? `${q.job_name ? ' · ' : ''}with ${q.assigned_to}` : ''}</div>
            </div>
            <div className="na-act">
              {q.rush === 'Super Rush' && <span className="pill pill-coral font-bold">SUPER RUSH</span>}
              {q.rush === 'Rush' && <span className="pill pill-amber font-semibold">RUSH</span>}
              <span className={'pill pill-' + (COLOR[q.status] || 'gray')}>{chip}</span>
              <div className="na-val">{money(q.price)}</div>
              <Button variant="ghost" size="icon-sm" className="icon-btn" title="Open quote" onClick={() => onOpen(q.quote_id)}><IcChevR size={16} /></Button>
            </div>
          </div>
        )
      })}
      {needs.length > 0 && <div className="panel-foot" onClick={onViewAll}>View all needs attention →</div>}
    </div>
  )
}
