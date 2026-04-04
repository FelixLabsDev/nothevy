import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { BarChart2, TrendingUp, Sparkles } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { db } from '@/db'
import { useSettingsStore } from '@/stores/settingsStore'
import { getWeeklyInsight } from '@/lib/ai'
import PageHeader from '@/components/PageHeader'

export default function History() {
  const navigate = useNavigate()
  const { settings } = useSettingsStore()
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  const sessions = useLiveQuery(
    () => db.sessions.where('completedAt').above(0).reverse().sortBy('completedAt'),
    []
  )

  // Chart data: volume per day (last 30 sessions)
  const chartData = sessions?.slice(0, 30).reverse().map(s => ({
    date: new Date(s.startedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    volume: s.totalVolumeKg
  }))

  const fetchInsight = async () => {
    if (!sessions?.length) return
    const apiKey = settings.aiApiKey
    if (!apiKey) { setInsight('Add an API key in Settings to get insights.'); return }
    setInsightLoading(true)
    const config = { provider: settings.aiProvider ?? 'claude', apiKey, model: settings.aiModel }
    try {
      const msg = await getWeeklyInsight(sessions.slice(0, 10), config)
      setInsight(msg)
    } catch { setInsight('Could not reach Claude.') }
    setInsightLoading(false)
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title="History" />

      {/* Volume chart */}
      {chartData && chartData.length > 1 && (
        <div className="card mb-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={16} className="text-brand-400" />
            <span className="font-semibold text-sm">Volume Over Time</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="volume" stroke="#22c55e" fill="url(#vGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly insight */}
      <div className="card mb-5">
        <button
          className="flex items-center gap-2 text-sm text-brand-400 mb-2"
          onClick={fetchInsight}
          disabled={insightLoading}
        >
          <Sparkles size={16} />
          {insightLoading ? 'Generating insight…' : 'Get weekly AI insight'}
        </button>
        {insight && <p className="text-sm text-slate-300 leading-relaxed">{insight}</p>}
      </div>

      {/* Session list */}
      <div className="space-y-2">
        {sessions?.map(s => (
          <button
            key={s.id}
            className="card w-full text-left flex items-center justify-between gap-3"
            onClick={() => navigate(`/session/${s.id}`)}
          >
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-slate-500">{new Date(s.startedAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-brand-400">{s.totalVolumeKg}kg</p>
              <p className="text-xs text-slate-500">{s.slots.length} exercises</p>
            </div>
          </button>
        ))}
        {sessions?.length === 0 && (
          <div className="text-center text-slate-500 py-12 text-sm">
            <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
            No completed sessions yet.
          </div>
        )}
      </div>
    </div>
  )
}
