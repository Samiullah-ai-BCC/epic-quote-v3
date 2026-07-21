import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { IcMail, IcSend } from '../icons'
import { money } from './meta'

/* Quotes nobody has chased yet. Notes save on blur (only when changed); "Sent" flags the chase. */
export default function FollowUps({ followups, isViewer, update, onOpen }) {
  if (!followups.length) return null
  return (
    <div className="panel">
      <div className="panel-head">
        <b className="ph"><span className="ph-ico teal"><IcMail size={14} /></span> Follow-ups needed</b>
        <span className="muted sm">Nobody has chased yet</span>
      </div>
      {followups.map((q) => (
        <div key={q.quote_id} className="fu-row">
          <div className="fu-top">
            <div className="na-info">
              <div className="na-id">{q.quote_id} · {q.company_name || '—'}</div>
              <div className="na-sub">{q.status}{q.days_waiting > 0 ? ` · waiting ${q.days_waiting}d` : ''}</div>
            </div>
            <div className="na-val">{money(q.price)}</div>
          </div>
          {!isViewer && <Input
            defaultValue={q.followup_notes}
            placeholder="Follow-up notes… (saved when you click away)"
            className="mt-2 text-xs"
            onBlur={(e) => { if (e.target.value !== q.followup_notes) update.mutate({ id: q.quote_id, patch: { followup_notes: e.target.value } }) }}
          />}
          <div className="fu-actions">
            <Button variant="outline" size="sm" className="ghost sm" onClick={() => onOpen(q.quote_id)}>Open</Button>
            {!isViewer && <Button size="sm" className="sm" onClick={() => update.mutate({ id: q.quote_id, patch: { followup_sent: true } })}><IcSend size={13} /> Sent</Button>}
          </div>
        </div>
      ))}
    </div>
  )
}
