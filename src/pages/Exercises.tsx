import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X, SlidersHorizontal } from 'lucide-react'
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
  const [activeMuscles, setActiveMuscles] = useState<string[]>([])
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const { settings } = useSettingsStore()
  const imagePreview = settings.exerciseImagePreview !== false

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const allMuscles = useMemo(() => {
    const set = new Set<string>()
    exercises?.forEach(e => e.muscleGroups.forEach(m => set.add(m)))
    return [...set].sort()
  }, [exercises])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    exercises?.forEach(e => e.tags.forEach(t => set.add(t)))
    return [...set].sort()
  }, [exercises])

  const filtered = useMemo(() => {
    return exercises?.filter(e => {
      const matchesSearch = !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      const matchesMuscle = activeMuscles.length === 0 ||
        activeMuscles.some(m => e.muscleGroups.includes(m))
      const matchesTag = activeTags.length === 0 ||
        activeTags.some(t => e.tags.includes(t))
      return matchesSearch && matchesMuscle && matchesTag
    }) ?? []
  }, [exercises, search, activeMuscles, activeTags])

  const activeFilterCount = activeMuscles.length + activeTags.length

  const toggleMuscle = (m: string) =>
    setActiveMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleTag = (t: string) =>
    setActiveTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const clearFilters = () => { setActiveMuscles([]); setActiveTags([]) }

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
          className="input pl-9 pr-10"
          placeholder="Search exercises or tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition ${
            showFilters || activeFilterCount > 0
              ? 'text-indigo-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          onClick={() => setShowFilters(v => !v)}
          title="Filter"
        >
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-3 space-y-2.5 bg-slate-800/40 rounded-xl p-3">
          {allMuscles.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Muscle</p>
              <div className="flex flex-wrap gap-1.5">
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
            </div>
          )}
          {allTags.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tag</p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition ${
                      activeTags.includes(t)
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
            >
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      )}

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
