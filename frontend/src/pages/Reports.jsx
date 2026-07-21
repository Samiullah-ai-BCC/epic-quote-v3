import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import client from '../api/client'
import KpiTile from '../components/ui/KpiTile'
import { stagger } from '../components/ui/motion'
import { money, lastDelta } from '../components/reports/format'
import TrendChart from '../components/reports/TrendChart'
import Funnel from '../components/reports/Funnel'
import Leaderboard from '../components/reports/Leaderboard'
import DetailTable from '../components/reports/DetailTable'

export default function Reports() {
  const { data: months = [] } = useQuery({
    queryKey: ['reports-monthly'],
    queryFn: async () => (await client.get('/reports/monthly')).data,
  })

  const kpis = useMemo(() => {
    const sum = (k) => months.reduce((a, m) => a + (Number(m[k]) || 0), 0)
    const created = sum('created')
    const won = sum('done')
    return {
      quoted: sum('quoted_value'),
      wonValue: sum('done_value'),
      conversion: created ? Math.round((won / created) * 100) : 0,
      created,
      series: {
        quoted: months.map((m) => m.quoted_value),
        wonValue: months.map((m) => m.done_value),
        created: months.map((m) => m.created),
      },
    }
  }, [months])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sales Reports</h1>
          <div className="sub">Pipeline health, month by month — last 12 months</div>
        </div>
        <span className="range-chip">Last 12 months</span>
      </div>

      {/* KPI hero — the story in four numbers, each counting up on load */}
      <motion.div className="kpi-row" variants={stagger} initial="hidden" animate="show">
        <KpiTile label="Quoted value" value={kpis.quoted} format={money} spark={kpis.series.quoted} delta={lastDelta(kpis.series.quoted)} />
        <KpiTile label="Won value" value={kpis.wonValue} format={money} spark={kpis.series.wonValue} delta={lastDelta(kpis.series.wonValue)} />
        <KpiTile label="Conversion" value={kpis.conversion} format={(v) => Math.round(v) + '%'} accent />
        <KpiTile label="Quotes created" value={kpis.created} spark={kpis.series.created} delta={lastDelta(kpis.series.created)} />
      </motion.div>

      <TrendChart months={months} />

      <div className="report-grid">
        <Funnel />
        <Leaderboard />
      </div>

      <DetailTable months={months} />
    </>
  )
}
