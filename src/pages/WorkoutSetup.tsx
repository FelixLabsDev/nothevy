import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronUp, ChevronDown, Play } from 'lucide-react'
import { db } from '@/db'
import { nanoid } from '@/lib/workout'
import { useActiveSessionStore } from '@/stores/sessionStore'
import PageHeader from '@/components/PageHeader'
import type { ExerciseSlot, Workout } from '@/types'

interface SetupRow {
  slot: ExerciseSlot
  included: boolean
}

// Build merged slots from workout template order; fresh ids so duplicates are safe
async function mergeTemplateSlots(templateIds: string[]): Promise<SetupRow[]> {
  const rows: SetupRow[] = []
  for (const tid of templateIds) {
    const t = await db.templates.get(tid)
    if (!t) continue
    const ordered = [...t.slots].sort((a, b) => a.orderIndex - b.orderIndex)
    for (const slot of ordered) {
      rows.push({
        included: true,
        slot: {
          ...slot,
          id: nanoid(),
          orderIndex: rows.length,
          sets: slot.sets.map(s => ({ ...s, id: nanoid() }))
        }
      })
    }
  }
  return rows
}

export default function WorkoutSetup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { startWorkout } = useActiveSessionStore()

  const workout = useLiveQuery<Workout | undefined>(() => (id ? db.workouts.get(id) : Promise.resolve(undefined)), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const [rows, setRows] = useState<SetupRow[] | null>(null)

  useEffect(() => {
    if (!workout) return
    void mergeTemplateSlots(workout.templateIds).then(setRows)
  }, [workout])

  const exName = (exerciseId: string) => exercises?.find(e => e.id === exerciseId)?.name ?? exerciseId

  const toggleRow = (idx: number) =>
    setRows(r => r && r.map((row, i) => i !== idx ? row : { ...row, included: !row.included }))

  const moveRow = (idx: number, dir: -1 | 1) => {
    setRows(r => {
      if (!r) return r
      const j = idx + dir
      if (j < 0 || j >= r.length) return r
      const next = [...r]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next.map((row, i) => ({ ...row, slot: { ...row.slot, orderIndex: i } }))
    })
  }

  const start = () => {
    if (!workout || !rows) return
    const slots: ExerciseSlot[] = rows.filter(x => x.included).map((x, i) => ({ ...x.slot, orderIndex: i }))
    if (slots.length === 0) return
    startWorkout(workout.id, workout.name, slots)
    navigate('/session/active')
  }

  if (!id) return null
  if (workout === undefined || rows === null) {
    return <div className="px-4 pb-nav mb-nav"><p className="text-slate-500 text-sm py-8">Loading…</p></div>
  }
  if (!workout) {
    return <div className="px-4 pb-nav mb-nav"><p className="text-slate-500 text-sm py-8">Workout not found.</p></div>
  }

  const includedCount = rows.filter(r => r.included).length

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title="Configure workout" back />

      <p className="text-sm text-slate-400 mb-3">{workout.name} — toggle exercises and reorder, then start.</p>

      <div className="space-y-2 mb-6">
        {rows.map((row, idx) => (
          <div key={row.slot.id} className={`card flex items-start gap-2 ${!row.included ? 'opacity-50' : ''}`}>
            <div className="flex flex-col gap-0.5 shrink-0 pt-0.5">
              <button type="button" className="p-0.5 rounded hover:bg-slate-700 text-slate-500" onClick={() => moveRow(idx, -1)} disabled={idx === 0}><ChevronUp size={16} /></button>
              <button type="button" className="p-0.5 rounded hover:bg-slate-700 text-slate-500" onClick={() => moveRow(idx, 1)} disabled={idx === rows.length - 1}><ChevronDown size={16} /></button>
            </div>
            <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
              <input type="checkbox" className="mt-1 rounded border-slate-600" checked={row.included} onChange={() => toggleRow(idx)} />
              <div>
                <p className="font-medium text-sm">{exName(row.slot.exerciseId)}</p>
                <p className="text-xs text-slate-500">{row.slot.sets.length} sets</p>
              </div>
            </label>
          </div>
        ))}
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={start} disabled={includedCount === 0}>
        <Play size={18} /> Start ({includedCount} exercise{includedCount !== 1 ? 's' : ''})
      </button>
    </div>
  )
}
