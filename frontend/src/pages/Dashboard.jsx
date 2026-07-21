import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboard, useQuotes, useConstants, useUpdateQuote } from '../hooks'
import { useSelector } from 'react-redux'
import { selectUser } from '../store/authSlice'
import { IcSun } from '../components/icons'
import { ATTN } from '../components/dashboard/meta'
import KpiRow from '../components/dashboard/KpiRow'
import NeedsAttention from '../components/dashboard/NeedsAttention'
import RecentQuotes from '../components/dashboard/RecentQuotes'
import FollowUps from '../components/dashboard/FollowUps'
import PipelineGrid from '../components/dashboard/PipelineGrid'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: dash } = useDashboard()
  const { data: constants } = useConstants()
  const user = useSelector(selectUser)
  const update = useUpdateQuote()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const params = {}
  if (search) params.search = search
  if (status) params.status = status
  const { data: quotes = [] } = useQuotes(params)

  const cards = dash?.cards || {}
  const statuses = constants?.statuses || []
  const needs = dash?.needs_attention || []
  const total = statuses.reduce((n, s) => n + (cards[s] || 0), 0)
  const attnCount = ATTN.reduce((n, s) => n + (cards[s] || 0), 0)
  const openCount = dash?.reports?.pending_count ?? 0

  const trend = (dash?.quotes_trend || []).map((t) => t.count)
  const isViewer = user?.role === 'viewer'

  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = (user?.full_name || user?.username || 'there').split(' ')[0]
  const recent = quotes.slice(0, 8)

  const openQuote = (quoteId) => navigate(`/quotes/${quoteId}/generate`, { state: { from: '/dashboard' } })

  return (
    <div className="dash">
      {/* ---- top bar ---- */}
      <div className="dash-topbar">
        <div className="greet">
          <div className="greet-row">
            <span className="greet-sun"><IcSun size={20} /></span>
            <h1>{greet}, {firstName}</h1>
          </div>
          <div className="greet-sub">
            {dateStr}{attnCount ? ` · ${attnCount} quote${attnCount > 1 ? 's' : ''} need your attention today` : ' · all clear today'}
          </div>
        </div>
        {isViewer && <span className="pill pill-gray" title="Your account can see everything but change nothing">View-only account</span>}
      </div>

      <KpiRow dash={dash} trend={trend} attnCount={attnCount} total={total} openCount={openCount} />

      {/* ---- two-column body ---- */}
      <div className="dash-cols">
        {/* LEFT: needs attention + recent quotes */}
        <div className="dash-col">
          <NeedsAttention needs={needs} onOpen={openQuote} onViewAll={() => navigate('/quotes')} />
          <RecentQuotes
            recent={recent} search={search} setSearch={setSearch}
            status={status} clearStatus={() => setStatus('')}
            onOpen={openQuote} onViewAll={() => navigate('/quotes')}
          />
        </div>

        {/* RIGHT: follow-ups + pipeline grid */}
        <div className="dash-col">
          <FollowUps followups={dash?.followups || []} isViewer={isViewer} update={update} onOpen={openQuote} />
          <PipelineGrid statuses={statuses} cards={cards} total={total} status={status} setStatus={setStatus} />
        </div>
      </div>
    </div>
  )
}
