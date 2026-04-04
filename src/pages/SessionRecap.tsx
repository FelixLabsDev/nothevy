import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Trophy, Clock, BarChart2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader'

function fmtDuration(ms: number) {
  const min = Math.floor(ms / 60000)
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`
}

export default function SessionRecap() {
  const { id } = useParams()
  const navigate = useNavigate()

  const session = useLiveQuery(() => db.sessions.get(id!), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const prs = useLiveQuery(
    () => db.personalRecords.where('sessionId').equals(id!).toArray(),
    [id]
  )

  const exName = (exerciseId: string) => exercises?.find(e => e.id === exerciseId)?.name ?? exerciseId

  if (!session) return null

  const duration = session.completedAt ? session.completedAt - session.startedAt : 0

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title="Session Recap" back />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card text-center">
          <BarChart2 size={20} className="mx-auto mb-1 text-brand-400" />
          <p className="font-bold text-lg">{session.totalVolumeKg}kg</p>
          <p className="text-xs text-slate-500">Volume</p>
        </div>
        <div className="card text-center">
          <Clock size={20} className="mx-auto mb-1 text-brand-400" />
          <p className="font-bold text-lg">{fmtDuration(duration)}</p>
          <p className="text-xs text-slate-500">Duration</p>
        </div>
        <div className="card text-center">
          <CheckCircle2 size={20} className="mx-auto mb-1 text-brand-400" />
          <p className="font-bold text-lg">
            {session.slots.reduce((a, s) => a + s.sets.filter(st => st.completedAt && !st.skipped).length, 0)}
          </p>
          <p className="text-xs text-slate-500">Sets Done</p>
        </div>
      </div>

      {/* PRs */}
      {prs && prs.length > 0 && (
        <div className="card mb-4 bg-yellow-900/20 border-yellow-700">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={16} className="text-yellow-400" />
            <span className="font-semibold text-yellow-300">Personal Records</span>
          </div>
          {prs.map(pr => (
            <div key={pr.id} className="text-sm text-yellow-200">
              {exName(pr.exerciseId)} — {pr.type.replace('_', ' ')}: {pr.value.toFixed(1)}
            </div>
          ))}
        </div>
      )}

      {/* Exercise breakdown */}
      <div className="space-y-3">
        {session.slots.map(slot => (
          <div key={slot.id} className="card">
            <p className="font-semibold mb-2">{exName(slot.exerciseId)}</p>
            <div className="space-y-1">
              {slot.sets.map((set, i) => (
                <div key={set.id} className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500 w-5">{i + 1}</span>
                  {set.skipped ? (
                    <span className="text-slate-600 italic">skipped</span>
                  ) : set.type === 'timed' ? (
                    <span className="text-slate-300">{set.actualDurationSeconds ?? set.durationSeconds}s</span>
                  ) : (
                    <span className="text-slate-300">
                      {set.actualWeight ?? set.weight ?? 0}{set.weightUnit} × {set.actualReps ?? set.reps ?? 0} reps
                    </span>
                  )}
                  {set.completedAt && !set.skipped && (
                    <CheckCircle2 size={14} className="text-brand-500 ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
