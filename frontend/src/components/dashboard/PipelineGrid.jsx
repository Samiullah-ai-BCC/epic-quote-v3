import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { IcClipboard } from '../icons'
import { COLOR, STATUS_ICON } from './meta'

/* Status tiles: one per pipeline stage, click to filter the recent-quotes table. */
export default function PipelineGrid({ statuses, cards, total, status, setStatus }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <b className="ph">Pipeline</b>
        <span className="muted sm">{total} active · click to filter</span>
      </div>
      <div className="pipe-grid">
        {statuses.map((s) => {
          const Icon = STATUS_ICON[s] || IcClipboard
          const c = cards[s] || 0
          const on = status === s
          return (
            <Button key={s} variant="ghost"
              className={cn('pipe-tile h-auto flex-col whitespace-normal', on && 'on', c === 0 && 'zero')}
              onClick={() => setStatus(on ? '' : s)} title={s}>
              <span className={'pt-ico seg-' + (COLOR[s] || 'gray')}><Icon size={15} /></span>
              <span className="pt-num">{c}</span>
              <span className="pt-lbl">{s}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
