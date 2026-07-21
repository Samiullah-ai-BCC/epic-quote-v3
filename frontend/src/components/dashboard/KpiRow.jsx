import { IcTrendUp, IcDollar, IcGauge, IcBell } from '../icons'
import { AreaSpark, MiniLine, MiniBars, Ring } from './MiniCharts'
import { money } from './meta'

/* The four headline tiles: quotes trend (hero), pipeline value, avg value, needs-attention gauge. */
export default function KpiRow({ dash, trend, attnCount, total, openCount }) {
  return (
    <div className="kpis">
      <div className="kpi feature">
        <div className="kpi-head"><span className="kpi-ico gold"><IcTrendUp size={16} /></span><span className="kpi-k">Quotes · last 30 days</span></div>
        <div className="kpi-v">
          {dash?.totals?.total_quotes_month ?? '—'}
          {dash?.quotes_delta != null && <span className={'kpi-delta ' + (dash.quotes_delta >= 0 ? 'up' : 'down')}>{dash.quotes_delta >= 0 ? '▲' : '▼'} {Math.abs(dash.quotes_delta)}%</span>}
        </div>
        <div className="kpi-sub">vs previous 30 days</div>
        <div className="kpi-chart"><AreaSpark counts={trend} stroke="#f9a600" id="sparkHero" /></div>
      </div>

      <div className="kpi">
        <div className="kpi-head"><span className="kpi-ico blue"><IcDollar size={16} /></span><span className="kpi-k">Pipeline value</span></div>
        <div className="kpi-v">{dash ? money(dash.pipeline_value) : '—'}</div>
        <div className="kpi-sub">{openCount} open quote{openCount === 1 ? '' : 's'}</div>
        <div className="kpi-chart"><MiniBars counts={trend} color="#378add" /></div>
      </div>

      <div className="kpi">
        <div className="kpi-head"><span className="kpi-ico teal"><IcGauge size={16} /></span><span className="kpi-k">Avg quote value</span></div>
        <div className="kpi-v">{dash ? money(dash.avg_quote_value) : '—'}</div>
        <div className="kpi-sub">across open work</div>
        <div className="kpi-chart"><MiniLine counts={trend} stroke="#1d9e75" /></div>
      </div>

      <div className="kpi">
        <div className="kpi-head"><span className="kpi-ico gold"><IcBell size={16} /></span><span className="kpi-k">Needs attention</span></div>
        <div className="kpi-gauge">
          <div>
            <div className="kpi-v mt-0">{dash ? attnCount : '—'}</div>
            <div className="kpi-sub">act today</div>
          </div>
          <Ring pct={total ? attnCount / total : 0} color="#f9a600" />
        </div>
      </div>
    </div>
  )
}
