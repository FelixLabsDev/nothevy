import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Search, Play, Check } from 'lucide-react'
import { nanoid } from 'nanoid'
import { db } from '@/db'
import { useActiveSessionStore } from '@/stores/sessionStore'
import type { Exercise, ExerciseSlot, SetTarget } from '@/types'

function makeSlotFromExercise(ex: Exercise, orderIndex: number): ExerciseSlot {
  const sets: SetTarget[] = ex.defaultSets.length > 0
    ? ex.defaultSets.map(s => ({ ...s, id: nanoid() }))
    : [{ id: nanoid(), type: ex.defaultSetType, reps: 10, weightUnit: 'kg' as const, restSeconds: ex.defaultRestSeconds }]
  return { id: nanoid(), exerciseId: ex.id, orderIndex, sets }
}

export default function CustomWorkout() {
  const navigate = useNavigate()
  const startWorkout = useActiveSessionStore(s => s.startWorkout)

  const [workoutName, setWorkoutName] = useState('Custom Workout')
  const [activeMuscles, setActiveMuscles] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set())
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set())

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  const templates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [])

  const allMuscles = useMemo(() => {
    const set = new Set<string>()
    exercises?.forEach(e => e.muscleGroups.forEach(m => set.add(m)))
    return [...set].sort()
  }, [exercises])

  const filteredExercises = useMemo(() => {
    return exercises?.filter(e => {
      const matchesMuscle = activeMuscles.length === 0 || activeMuscles.some(m => e.muscleGroups.includes(m))
      const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase())
      return matchesMuscle && matchesSearch
    }) ?? []
  }, [exercises, activeMuscles, search])

  const toggleMuscle = (m: string) =>
    setActiveMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleExercise = (id: string) =>
    setSelectedExerciseIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleTemplate = (id: string) =>
    setSelectedTemplateIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const totalCount = selectedExerciseIds.size + selectedTemplateIds.size

  const handleStart = () => {
    if (!totalCount) return

    const exerciseSlots: ExerciseSlot[] = []
    let orderIndex = 0

    for (const ex of (exercises ?? [])) {
      if (selectedExerciseIds.has(ex.id)) {
        exerciseSlots.push(makeSlotFromExercise(ex, orderIndex++))
      }
    }

    const templateSlots: ExerciseSlot[] = []
    for (const t of (templates ?? [])) {
      if (selectedTemplateIds.has(t.id)) {
        for (const slot of t.slots) {
          templateSlots.push({ ...slot, id: nanoid(), orderIndex: orderIndex++ })
        }
      }
    }

    startWorkout(nanoid(), workoutName.trim() || 'Custom Workout', [...exerciseSlots, ...templateSlots])
    navigate('/session/active')
  }

  return (
    <div className="px-4 pb-36 mb-nav">
      {/* Header */}
      <div className="flex items-center gap-3 pt-4 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Custom Workout</h1>
      </div>

      {/* Name input */}
      <div className="mb-5">
        <input
          className="input font-medium"
          value={workoutName}
          onChange={e => setWorkoutName(e.target.value)}
          placeholder="Workout name"
        />
      </div>

      {/* ── Exercises ──────────────────────────────── */}
      <section className="mb-6">
        <h2 className="font-semibold text-slate-300 mb-3">Exercises</h2>

        {/* Muscle chips */}
        {allMuscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allMuscles.map(m => (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                  activeMuscles.includes(m)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {m.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-8 text-sm"
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Exercise list */}
        {filteredExercises.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No exercises match.</p>
        ) : (
          <div className="space-y-1.5">
            {filteredExercises.map(e => {
              const selected = selectedExerciseIds.has(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggleExercise(e.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
                    selected
                      ? 'bg-indigo-600/20 border border-indigo-500/40'
                      : 'bg-slate-800/60 hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                    selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'
                  }`}>
                    {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{e.name}</p>
                    {e.muscleGroups.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {e.muscleGroups.map(m => m.replace(/_/g, ' ')).join(' · ')}
                      </p>
                    )}
                  </div>
                  {e.defaultSets.length > 0 && (
                    <span className="text-xs text-slate-500 shrink-0">{e.defaultSets.length} sets</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Templates ─────────────────────────────── */}
      {(templates?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h2 className="font-semibold text-slate-300 mb-3">Templates</h2>
          <div className="space-y-1.5">
            {templates!.map(t => {
              const selected = selectedTemplateIds.has(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTemplate(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
                    selected
                      ? 'bg-violet-600/20 border border-violet-500/40'
                      : 'bg-slate-800/60 hover:bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                    selected ? 'bg-violet-600 border-violet-600' : 'border-slate-600'
                  }`}>
                    {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t.slots.length} exercise{t.slots.length !== 1 ? 's' : ''}
                      {t.estimatedMinutes ? ` · ~${t.estimatedMinutes} min` : ''}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Sticky start bar */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] left-0 right-0 px-4 max-w-lg mx-auto">
        <div className="bg-slate-900/95 backdrop-blur border border-slate-700/50 rounded-2xl p-3 flex items-center gap-3 shadow-xl">
          <div className="flex-1 min-w-0">
            {totalCount > 0 ? (
              <p className="text-sm font-medium text-slate-200">
                {selectedExerciseIds.size > 0 && `${selectedExerciseIds.size} exercise${selectedExerciseIds.size !== 1 ? 's' : ''}`}
                {selectedExerciseIds.size > 0 && selectedTemplateIds.size > 0 && ' + '}
                {selectedTemplateIds.size > 0 && `${selectedTemplateIds.size} template${selectedTemplateIds.size !== 1 ? 's' : ''}`}
              </p>
            ) : (
              <p className="text-sm text-slate-500">Select exercises or templates</p>
            )}
          </div>
          <button
            onClick={handleStart}
            disabled={totalCount === 0}
            className="btn-primary text-sm px-4 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Play size={15} />
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
