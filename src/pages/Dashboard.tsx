import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Play, Plus, TrendingUp, Dumbbell } from 'lucide-react'
import { db } from '@/db'
import { useActiveSessionStore } from '@/stores/sessionStore'
import PageHeader from '@/components/PageHeader'
import type { WorkoutSession } from '@/types'

// Format elapsed time nicely
function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60000)
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { session, clearSession } = useActiveSessionStore()

  // Last 5 completed sessions for the recent history card
  const recentSessions = useLiveQuery(
    () => db.sessions.where('completedAt').above(0).reverse().sortBy('completedAt').then(s => s.slice(0, 5)),
    []
  )

  // Quick-start: the 3 most recently updated templates
  const recentTemplates = useLiveQuery(
    () => db.templates.orderBy('updatedAt').reverse().limit(3).toArray(),
    []
  )

  const handleQuickStart = (templateId: string) => {
    navigate(`/templates/${templateId}?start=1`)
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title="NotHevy" />

      {/* In-progress session banner */}
      {session && !session.completedAt && (
        <div className="card mb-4 bg-brand-900/30 border-brand-700 flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-400 font-medium uppercase tracking-wide">In progress</p>
            <p className="font-semibold text-slate-100">{session.name}</p>
          </div>
          <button className="btn-primary text-sm" onClick={() => navigate('/session/active')}>
            Resume
          </button>
        </div>
      )}

      {/* Quick-start templates */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-300">Quick Start</h2>
          <button className="text-xs text-brand-400" onClick={() => navigate('/templates')}>See all</button>
        </div>
        {recentTemplates?.length ? (
          <div className="space-y-2">
            {recentTemplates.map(t => (
              <div key={t.id} className="card flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.slots.length} exercises · ~{t.estimatedMinutes ?? '?'} min</p>
                </div>
                <button className="btn-primary text-sm px-3 py-2 shrink-0" onClick={() => handleQuickStart(t.id)}>
                  <Play size={14} />
                  Start
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            className="card w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 transition"
            onClick={() => navigate('/templates/new')}
          >
            <Plus size={18} />
            <span>Create your first template</span>
          </button>
        )}
      </section>

      {/* Recent sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-300">Recent Workouts</h2>
          <button className="text-xs text-brand-400" onClick={() => navigate('/history')}>History</button>
        </div>
        {recentSessions?.length ? (
          <div className="space-y-2">
            {recentSessions.map((s: WorkoutSession) => (
              <button
                key={s.id}
                className="card w-full text-left flex items-center gap-3"
                onClick={() => navigate(`/session/${s.id}`)}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Dumbbell size={18} className="text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.startedAt).toLocaleDateString()} · {s.totalVolumeKg}kg volume
                  </p>
                </div>
                <div className="text-xs text-slate-500 shrink-0">
                  {s.completedAt ? formatDuration(s.completedAt - s.startedAt) : '—'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="card text-center text-slate-500 py-8">
            <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No workouts yet — start one above!</p>
          </div>
        )}
      </section>
    </div>
  )
}
