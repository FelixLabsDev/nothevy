import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X } from 'lucide-react'
import { db } from '@/db'
import { useSettingsStore } from '@/stores/settingsStore'
import PageHeader from '@/components/PageHeader'
import ExerciseFormSheet from '@/components/ExerciseFormSheet'
import type { Exercise } from '@/types'

type SortMode = 'muscle' | 'tag' | 'alpha'

interface Group { label: string; items: Exercise[] }

function buildGroups(exercises: Exercise[], mode: SortMode): Group[] | null {
  if (mode === 'alpha') return null

  const fallback = mode === 'muscle' ? 'Uncategorized' : 'Untagged'
  const map = new Map<string, Exercise[]>()

  for (const ex of exercises) {
    const keys = mode === 'muscle' ? ex.muscleGroups : ex.tags
    const buckets = keys.length ? keys : [fallback]
    for (const k of buckets) {
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(ex)
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === fallback) return 1
      if (b === fallback) return -1
      return a.localeCompare(b)
    })
    .map(([label, items]) => ({
      label: label.replace(/_/g, ' '),
      items: items.sort((a, b) => a.name.localeCompare(b.name))
    }))
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Exercises() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('muscle')
  const [showForm, setShowForm] = useState(false)
  const [editExercise, setEditExercise] = useState<Exercise | undefined>(undefined)
  const { settings } = useSettingsStore()
  const imagePreview = settings.exerciseImagePreview !== false

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const filtered = exercises?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  ) ?? []

  const groups = buildGroups(filtered, sort)

  const openCreate = () => { setEditExercise(undefined); setShowForm(true) }
  const openEdit = (e: Exercise) => { setEditExercise(e); setShowForm(true) }

  const remove = async (id: string) => {
    if (confirm('Delete this exercise?')) await db.exercises.delete(id)
  }

  const SORTS: { id: SortMode; label: string }[] = [
    { id: 'muscle', label: 'Muscle' },
    { id: 'tag',    label: 'Tag' },
    { id: 'alpha',  label: 'A–Z' },
  ]

  const ExerciseCard = ({ e }: { e: Exercise }) => {
    const firstImage = e.media?.find(m => m.type === 'image')
    return (
      <div className="card relative overflow-hidden flex items-center gap-3 cursor-pointer" onClick={() => openEdit(e)}>
        {imagePreview && firstImage && (
          <img
            src={firstImage.url}
            alt=""
            className="absolute top-0 right-[5%] h-full w-1/2 object-cover"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
            }}
          />
        )}
        <div className="relative flex-1 min-w-0">
          <p className="font-medium">{e.name}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {e.muscleGroups.map(m => <span key={m} className="chip">{m.replace(/_/g, ' ')}</span>)}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {e.defaultSets?.length > 0 && (
              <p className="text-xs text-slate-500">
                {e.defaultSets.length} set{e.defaultSets.length !== 1 ? 's' : ''} · {
                  e.defaultSets[0].restSeconds === 0 ? 'no rest' : `${e.defaultSets[0].restSeconds}s rest`
                }
              </p>
            )}
          </div>
        </div>
        <button
          className="relative p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-red-400 transition shrink-0"
          onClick={ev => { ev.stopPropagation(); remove(e.id) }}
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader
        title="Exercises"
        actions={
          <button className="btn-primary text-sm" onClick={openCreate}>
            <Plus size={16} /> Add
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-9"
          placeholder="Search exercises or tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Sort toggle */}
      <div className="flex gap-1.5 mb-4 bg-slate-800/60 rounded-xl p-1">
        {SORTS.map(({ id, label }) => (
          <button
            key={id}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${
              sort === id
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            onClick={() => setSort(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-12 text-sm">No exercises found.</div>
      ) : groups ? (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 capitalize">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map(e => <ExerciseCard key={e.id} e={e} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => <ExerciseCard key={e.id} e={e} />)}
        </div>
      )}

      {showForm && (
        <ExerciseFormSheet
          initialExercise={editExercise}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
