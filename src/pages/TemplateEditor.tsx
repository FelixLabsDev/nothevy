import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, GripVertical, Sparkles } from 'lucide-react'
import { db } from '@/db'
import { nanoid } from '@/lib/workout'
import { generateTemplate } from '@/lib/ai'
import { useSettingsStore } from '@/stores/settingsStore'
import PageHeader from '@/components/PageHeader'
import ExerciseFormSheet from '@/components/ExerciseFormSheet'
import type { WorkoutTemplate, ExerciseSlot, SetTarget, SetType } from '@/types'

// Blank set with global default rest
const blankSet = (rest = 120): SetTarget => ({
  id: nanoid(), type: 'reps', reps: 8, weight: undefined, weightUnit: 'kg', restSeconds: rest
})

// Blank exercise slot
const blankSlot = (orderIndex: number, rest = 120): ExerciseSlot => ({
  id: nanoid(), exerciseId: '', orderIndex, sets: [blankSet(rest)], notes: ''
})

export default function TemplateEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettingsStore()
  const defaultRest = settings.defaultRestSeconds ?? 120
  const isNew = !id

  const existing = useLiveQuery<WorkoutTemplate | undefined>(
    () => id ? db.templates.get(id) : Promise.resolve(undefined),
    [id]
  )

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [slots, setSlots] = useState<ExerciseSlot[]>([blankSlot(0, defaultRest)])
  const [aiGoal, setAiGoal] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [newExerciseForSlot, setNewExerciseForSlot] = useState<number | null>(null)

  // Hydrate form when editing an existing template
  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setEstimatedMinutes(existing.estimatedMinutes ?? '')
      setTags(existing.tags)
      setSlots(existing.slots)
    }
  }, [existing])

  const save = async () => {
    if (!name.trim()) return
    const now = Date.now()
    const template: WorkoutTemplate = {
      id: id ?? nanoid(),
      name,
      description: description || undefined,
      tags,
      slots: slots.map((s, i) => ({ ...s, orderIndex: i })),
      estimatedMinutes: estimatedMinutes ? +estimatedMinutes : undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    await db.templates.put(template)
    navigate('/templates')
  }

  // AI-generate template from natural language goal
  const generateFromAI = async () => {
    const apiKey = settings.aiApiKey
    if (!apiKey) { setAiError('Add an API key in Settings first.'); return }
    if (!aiGoal.trim()) return
    setAiLoading(true)
    setAiError('')
    const config = { provider: settings.aiProvider ?? 'claude', apiKey, model: settings.aiModel }
    try {
      const generated = await generateTemplate(aiGoal, config)
      setName(generated.name)
      setDescription(generated.description ?? '')
      setEstimatedMinutes(generated.estimatedMinutes ?? '')
      setTags(generated.tags)
      setSlots(generated.slots)
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI generation failed.')
    } finally {
      setAiLoading(false)
    }
  }

  // Slot mutations
  const addSlot = () => setSlots(s => [...s, blankSlot(s.length, defaultRest)])
  const removeSlot = (idx: number) => setSlots(s => s.filter((_, i) => i !== idx))

  // When exercise selection changes, copy its defaultSets into the slot
  const setExercise = async (slotIdx: number, exerciseId: string) => {
    const ex = exercises?.find(e => e.id === exerciseId)
    const sets = ex?.defaultSets?.length
      ? ex.defaultSets.map(s => ({ ...s, id: nanoid() }))
      : [blankSet(ex?.defaultRestSeconds ?? defaultRest)]
    setSlots(s => s.map((slot, i) => i !== slotIdx ? slot : { ...slot, exerciseId, sets }))
  }

  // Per-slot set mutations
  const updateSet = (slotIdx: number, setIdx: number, patch: Partial<SetTarget>) =>
    setSlots(s => s.map((slot, i) => i !== slotIdx ? slot : {
      ...slot,
      sets: slot.sets.map((set, j) => j !== setIdx ? set : { ...set, ...patch })
    }))

  const addSetToSlot = (slotIdx: number) =>
    setSlots(s => s.map((slot, i) => i !== slotIdx ? slot : {
      ...slot,
      sets: [...slot.sets, blankSet(slot.sets[slot.sets.length - 1]?.restSeconds ?? defaultRest)]
    }))

  const removeSetFromSlot = (slotIdx: number, setIdx: number) =>
    setSlots(s => s.map((slot, i) => i !== slotIdx ? slot : {
      ...slot,
      sets: slot.sets.filter((_, j) => j !== setIdx)
    }))

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(ts => [...ts, t])
    setTagInput('')
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title={isNew ? 'New Template' : 'Edit Template'} back
        actions={<button className="btn-primary text-sm" onClick={save}>Save</button>}
      />

      {/* AI generation */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-brand-400" />
          <span className="font-semibold text-sm">Generate with AI</span>
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="e.g. upper body push day for hypertrophy"
            value={aiGoal}
            onChange={e => setAiGoal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') generateFromAI() }}
          />
          <button className="btn-primary text-sm shrink-0" onClick={generateFromAI} disabled={aiLoading}>
            {aiLoading ? '…' : 'Go'}
          </button>
        </div>
        {aiError && <p className="text-xs text-red-400 mt-2">{aiError}</p>}
      </div>

      {/* Template meta */}
      <div className="space-y-3 mb-5">
        <input className="input" placeholder="Template name *" value={name} onChange={e => setName(e.target.value)} />
        <input className="input" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" type="number" placeholder="Est. minutes" value={estimatedMinutes}
            onChange={e => setEstimatedMinutes(e.target.value ? +e.target.value : '')} />
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" placeholder="Tag" value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
            <button className="btn-ghost text-sm" onClick={addTag}>+</button>
          </div>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => (
              <span key={t} className="chip gap-1">
                {t}
                <button onClick={() => setTags(ts => ts.filter(x => x !== t))}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Exercise slots */}
      <div className="space-y-3 mb-4">
        {slots.map((slot, si) => {
          const ex = exercises?.find(e => e.id === slot.exerciseId)
          return (
            <div key={slot.id} className="card">
              {/* Exercise picker */}
              <div className="flex items-center gap-2 mb-2">
                <GripVertical size={16} className="text-slate-600" />
                <select
                  className="input flex-1 text-sm"
                  value={slot.exerciseId}
                  onChange={e => setExercise(si, e.target.value)}
                >
                  <option value="">— Select exercise —</option>
                  {exercises?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button
                  title="Create new exercise"
                  onClick={() => setNewExerciseForSlot(si)}
                  className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-brand-400 shrink-0"
                >
                  <Plus size={16} />
                </button>
                <button onClick={() => removeSlot(si)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-500 hover:text-red-400">
                  <X size={16} />
                </button>
              </div>

              {/* Editable sets for this slot — independent of exercise defaults */}
              {slot.sets.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1.5rem_3rem_1fr_1fr_1fr_1.5rem] gap-1 text-[10px] text-slate-600 uppercase tracking-wide pl-1 pr-1">
                    <span />
                    <span>Type</span>
                    <span>{slot.sets.some(s => s.type === 'timed') ? 'Dur (s)' : 'Reps'}</span>
                    <span>Wt (kg)</span>
                    <span>Rest (s)</span>
                    <span />
                  </div>

                  {slot.sets.map((set, setIdx) => (
                    <div key={set.id} className="grid grid-cols-[1.5rem_3rem_1fr_1fr_1fr_1.5rem] gap-1 items-center">
                      {/* Row number */}
                      <span className="text-[10px] text-slate-600 text-center">{setIdx + 1}</span>

                      {/* Set type selector */}
                      <select
                        className="input text-[11px] px-1 py-0.5 h-7"
                        value={set.type}
                        onChange={e => updateSet(si, setIdx, { type: e.target.value as SetType })}
                      >
                        <option value="reps">Reps</option>
                        <option value="timed">Time</option>
                        <option value="failure">Fail</option>
                      </select>

                      {/* Reps or duration */}
                      {set.type === 'timed' ? (
                        <input
                          className="input text-xs px-1.5 py-0.5 h-7 text-center"
                          type="number" min={0}
                          value={set.durationSeconds ?? ''}
                          placeholder="—"
                          onChange={e => updateSet(si, setIdx, { durationSeconds: e.target.value ? +e.target.value : undefined })}
                        />
                      ) : (
                        <input
                          className="input text-xs px-1.5 py-0.5 h-7 text-center"
                          type="number" min={0}
                          value={set.reps ?? ''}
                          placeholder="—"
                          onChange={e => updateSet(si, setIdx, { reps: e.target.value ? +e.target.value : undefined })}
                        />
                      )}

                      {/* Weight */}
                      <input
                        className="input text-xs px-1.5 py-0.5 h-7 text-center"
                        type="number" min={0} step={0.5}
                        value={set.weight ?? ''}
                        placeholder="—"
                        onChange={e => updateSet(si, setIdx, { weight: e.target.value ? +e.target.value : undefined })}
                      />

                      {/* Rest */}
                      <input
                        className="input text-xs px-1.5 py-0.5 h-7 text-center"
                        type="number" min={0} step={15}
                        value={set.restSeconds}
                        onChange={e => updateSet(si, setIdx, { restSeconds: e.target.value ? +e.target.value : 0 })}
                      />

                      {/* Remove set */}
                      <button
                        onClick={() => removeSetFromSlot(si, setIdx)}
                        disabled={slot.sets.length === 1}
                        className="p-0.5 rounded hover:bg-red-900/30 text-slate-600 hover:text-red-400 disabled:opacity-20 disabled:pointer-events-none"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {/* Add set to this slot */}
                  <button
                    onClick={() => addSetToSlot(si)}
                    className="ml-6 mt-1 text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add set
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn-ghost w-full" onClick={addSlot}>
        <Plus size={16} /> Add Exercise
      </button>

      {newExerciseForSlot !== null && (
        <ExerciseFormSheet
          onClose={() => setNewExerciseForSlot(null)}
          onSaved={id => {
            setExercise(newExerciseForSlot, id)
            setNewExerciseForSlot(null)
          }}
        />
      )}
    </div>
  )
}
