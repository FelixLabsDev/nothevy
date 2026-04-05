import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search, X, ImagePlus, Play, ZoomIn, Link, Upload, Loader2, RotateCcw } from 'lucide-react'
import { nanoid } from '@/lib/workout'
import { db } from '@/db'
import { useSettingsStore } from '@/stores/settingsStore'
import PageHeader from '@/components/PageHeader'
import type { Exercise, ExerciseMedia, MuscleGroup, Equipment, SetTarget, SetType } from '@/types'

const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'traps', 'lats', 'full_body'
]
const EQUIPMENT: Equipment[] = [
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight',
  'resistance_band', 'smith_machine', 'pull_up_bar', 'rings', 'other'
]

const blankSet = (type: SetType = 'reps', rest = 120): SetTarget => ({
  id: nanoid(), type, reps: type === 'timed' ? undefined : 8,
  durationSeconds: type === 'timed' ? 30 : undefined,
  weight: undefined, weightUnit: 'kg', restSeconds: rest
})

type SetRow = SetTarget & { rowCount: number }

const sameSetConfig = (a: SetTarget, b: SetTarget): boolean =>
  a.type === b.type &&
  a.reps === b.reps &&
  a.durationSeconds === b.durationSeconds &&
  a.weight === b.weight &&
  a.weightUnit === b.weightUnit &&
  a.restSeconds === b.restSeconds

const toSetRows = (sets: SetTarget[], fallbackRest: number): SetRow[] => {
  if (!sets.length) return [{ ...blankSet('reps', fallbackRest), rowCount: 1 }]
  const rows: SetRow[] = []
  for (const set of sets) {
    const last = rows[rows.length - 1]
    if (last && sameSetConfig(last, set)) {
      last.rowCount += 1
    } else {
      rows.push({ ...set, rowCount: 1 })
    }
  }
  return rows
}

const blank = (defaultRest = 120): Omit<Exercise, 'id' | 'createdAt'> => ({
  name: '', muscleGroups: [], equipment: [],
  defaultSetType: 'reps', defaultRestSeconds: defaultRest,
  defaultSets: [blankSet('reps', defaultRest)],
  media: [], instructions: '', tags: []
})

// ---------------------------------------------------------------------------
// MediaGrid — renders image/video thumbnails with revoke-on-unmount cleanup
// ---------------------------------------------------------------------------
function MediaGrid({
  items,
  onRemove,
  onPreview
}: {
  items: ExerciseMedia[]
  onRemove: (id: string) => void
  onPreview: (item: ExerciseMedia) => void
}) {
  // Keep a map of objectURLs so we can revoke them when the component unmounts
  const urlMap = useRef<Map<string, string>>(new Map())

  const getUrl = (item: ExerciseMedia): string => {
    if (!urlMap.current.has(item.id)) {
      urlMap.current.set(item.id, URL.createObjectURL(item.blob))
    }
    return urlMap.current.get(item.id)!
  }

  useEffect(() => {
    return () => { urlMap.current.forEach(u => URL.revokeObjectURL(u)) }
  }, [])

  if (!items.length) return null

  return (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {items.map(item => (
        <div key={item.id} className="relative group rounded-xl overflow-hidden bg-slate-800 aspect-square">
          {item.type === 'image' ? (
            <img src={getUrl(item)} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <video src={getUrl(item)} className="w-full h-full object-cover" muted playsInline />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button
              className="p-1.5 rounded-lg bg-slate-900/80 text-white"
              onClick={() => onPreview(item)}
            >
              {item.type === 'video' ? <Play size={14} /> : <ZoomIn size={14} />}
            </button>
            <button
              className="p-1.5 rounded-lg bg-red-900/80 text-white"
              onClick={() => onRemove(item.id)}
            >
              <X size={14} />
            </button>
          </div>
          {item.type === 'video' && (
            <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
              <Play size={10} className="text-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LightboxModal — full-screen preview
// ---------------------------------------------------------------------------
function Lightbox({ item, onClose }: { item: ExerciseMedia; onClose: () => void }) {
  const url = useRef(URL.createObjectURL(item.blob))
  useEffect(() => () => URL.revokeObjectURL(url.current), [])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-white" onClick={onClose}>
        <X size={20} />
      </button>
      {item.type === 'image' ? (
        <img src={url.current} alt={item.name} className="max-w-full max-h-full rounded-xl object-contain" />
      ) : (
        <video
          src={url.current}
          controls
          autoPlay
          className="max-w-full max-h-full rounded-xl"
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Exercises() {
  const { settings } = useSettingsStore()
  const defaultRest = settings.defaultRestSeconds ?? 120
  const defaultSetRowCount = settings.defaultSetRowCount ?? 3

  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(blank(defaultRest))
  const [tagInput, setTagInput] = useState('')
  const [setRows, setSetRows] = useState<SetRow[]>([{ ...blankSet('reps', defaultRest), rowCount: defaultSetRowCount }])
  const [lightbox, setLightbox] = useState<ExerciseMedia | null>(null)

  // Media picker state: null = closed, 'menu' = show options, 'url' = url input open
  const [mediaPicker, setMediaPicker] = useState<null | 'menu' | 'url'>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlFetching, setUrlFetching] = useState(false)
  const [urlError, setUrlError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])

  const filtered = exercises?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const openCreate = () => {
    setForm(blank(defaultRest))
    setSetRows([{ ...blankSet('reps', defaultRest), rowCount: defaultSetRowCount }])
    setEditId(null)
    setShowForm(true)
  }
  const openEdit = (e: Exercise) => {
    const rows = toSetRows(e.defaultSets?.length ? e.defaultSets : [blankSet(e.defaultSetType, e.defaultRestSeconds)], e.defaultRestSeconds)
    setSetRows(rows.map(row => ({ ...row, rowCount: row.rowCount || 1 })))
    setForm({
      name: e.name, muscleGroups: e.muscleGroups, equipment: e.equipment,
      defaultSetType: e.defaultSetType, defaultRestSeconds: e.defaultRestSeconds,
      defaultSets: e.defaultSets?.length ? e.defaultSets : [blankSet(e.defaultSetType, e.defaultRestSeconds)],
      media: e.media ?? [],
      instructions: e.instructions ?? '', tags: e.tags
    })
    setEditId(e.id)
    setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) return
    const expandedSets: SetTarget[] = setRows.flatMap(row => {
      const { rowCount, ...set } = row
      return Array.from({ length: Math.max(1, rowCount) }, () => ({ ...set, id: nanoid() }))
    })
    const firstSet = expandedSets[0]
    const derived = {
      defaultSetType: firstSet?.type ?? form.defaultSetType,
      defaultRestSeconds: firstSet?.restSeconds ?? form.defaultRestSeconds
    }
    const data = { ...form, defaultSets: expandedSets, ...derived }
    if (editId) {
      await db.exercises.update(editId, data)
    } else {
      await db.exercises.put({ ...data, id: nanoid(), createdAt: Date.now() })
    }
    setShowForm(false)
  }

  const remove = async (id: string) => {
    if (confirm('Delete this exercise?')) await db.exercises.delete(id)
  }

  const toggleArr = <T,>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !form.tags.includes(t)) setForm(f => ({ ...f, tags: [...f.tags, t] }))
    setTagInput('')
  }

  // --- Default set mutations ---
  const updateSet = (idx: number, patch: Partial<SetTarget>) =>
    setSetRows(rows => rows.map((s, i) => i !== idx ? s : { ...s, ...patch }))

  const removeSet = (idx: number) =>
    setSetRows(rows => rows.filter((_, i) => i !== idx))

  const addOneSet = () =>
    setSetRows(rows => {
      const last = rows[rows.length - 1]
      const next = last
        ? { ...last, id: nanoid(), rowCount: defaultSetRowCount }
        : { ...blankSet(form.defaultSetType, form.defaultRestSeconds), rowCount: defaultSetRowCount }
      return [...rows, next]
    })

  // --- Media mutations ---
  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const newMedia: ExerciseMedia[] = Array.from(files).map(file => ({
      id: nanoid(),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      blob: file,
      mimeType: file.type,
      name: file.name,
      addedAt: Date.now()
    }))
    setForm(f => ({ ...f, media: [...f.media, ...newMedia] }))
  }

  const removeMedia = (id: string) =>
    setForm(f => ({ ...f, media: f.media.filter(m => m.id !== id) }))

  // Fetch a remote image or video URL and store it as a Blob
  const fetchFromUrl = async () => {
    const url = urlInput.trim()
    if (!url) return
    setUrlFetching(true)
    setUrlError('')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const mimeType = blob.type || (url.match(/\.(mp4|webm|mov|avi)$/i) ? 'video/mp4' : 'image/jpeg')
      const type: 'image' | 'video' = mimeType.startsWith('video/') ? 'video' : 'image'
      const name = url.split('/').pop()?.split('?')[0] || 'media'
      const item: ExerciseMedia = { id: nanoid(), type, blob, mimeType, name, addedAt: Date.now() }
      setForm(f => ({ ...f, media: [...f.media, item] }))
      setUrlInput('')
      setMediaPicker(null)
    } catch (e: unknown) {
      setUrlError(e instanceof Error ? e.message : 'Could not fetch URL — check CORS or try uploading directly.')
    } finally {
      setUrlFetching(false)
    }
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
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-9"
          placeholder="Search exercises or tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Exercise list */}
      <div className="space-y-2">
        {filtered?.map(e => (
          <div key={e.id} className="card flex items-center gap-3 cursor-pointer" onClick={() => openEdit(e)}>
            <div className="flex-1 min-w-0">
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
                {e.media?.length > 0 && (
                  <p className="text-xs text-slate-500">{e.media.length} media</p>
                )}
              </div>
            </div>
            <button
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-red-400 transition shrink-0"
              onClick={ev => { ev.stopPropagation(); remove(e.id) }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {filtered?.length === 0 && (
          <div className="text-center text-slate-500 py-12 text-sm">No exercises found.</div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}

      {/* Create / Edit sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 pb-safe">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editId ? 'Edit' : 'New'} Exercise</h2>
              <div className="flex items-center gap-2">
                <button className="btn-primary text-sm px-3 py-2" onClick={save}>
                  {editId ? 'Apply' : 'Add'}
                </button>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-800"><X size={18} /></button>
              </div>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name *</label>
                <input className="input" placeholder="Barbell Bench Press" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Muscle groups */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Muscle Groups</label>
                <div className="flex flex-wrap gap-2">
                  {MUSCLE_GROUPS.map(m => (
                    <button
                      key={m}
                      className={`chip cursor-pointer ${form.muscleGroups.includes(m) ? 'bg-brand-700 text-brand-100' : ''}`}
                      onClick={() => setForm(f => ({ ...f, muscleGroups: toggleArr(f.muscleGroups, m) }))}
                    >
                      {m.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Equipment</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map(eq => (
                    <button
                      key={eq}
                      className={`chip cursor-pointer ${form.equipment.includes(eq) ? 'bg-brand-700 text-brand-100' : ''}`}
                      onClick={() => setForm(f => ({ ...f, equipment: toggleArr(f.equipment, eq) }))}
                    >
                      {eq.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default sets */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Default Sets</label>

                <div className="space-y-2">
                  {setRows.map((set, idx) => (
                    <div key={set.id} className="rounded-xl bg-slate-800/60 border border-slate-700 px-3 py-2 space-y-2">

                      {/* Row 1: set number · type · reps/duration · weight · delete */}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-xs w-4 shrink-0 text-center">{idx + 1}</span>
                        <select
                          className="input py-1 text-xs flex-1 min-w-0"
                          value={set.type}
                          onChange={e => updateSet(idx, { type: e.target.value as SetType })}
                        >
                          <option value="reps">Reps</option>
                          <option value="timed">Timed</option>
                          <option value="failure">Failure</option>
                        </select>
                        {set.type === 'timed' ? (
                          <input className="input py-1 text-xs flex-1 min-w-0" type="number" placeholder="sec" min={1} step={5}
                            value={set.durationSeconds ?? ''}
                            onChange={e => updateSet(idx, { durationSeconds: +e.target.value })} />
                        ) : (
                          <input className="input py-1 text-xs flex-1 min-w-0" type="number" placeholder="reps" min={1}
                            value={set.reps ?? ''}
                            onChange={e => updateSet(idx, { reps: +e.target.value })} />
                        )}
                        <input className="input py-1 text-xs flex-1 min-w-0" type="number" placeholder="kg" min={0} step={2.5}
                          value={set.weight ?? ''}
                          onChange={e => updateSet(idx, { weight: e.target.value ? +e.target.value : undefined })} />
                        <button className="text-slate-600 hover:text-red-400 shrink-0 ml-1" onClick={() => removeSet(idx)}>
                          <X size={14} />
                        </button>
                      </div>

                      {/* Row 2: sets count stepper · rest stepper */}
                      <div className="flex items-center gap-4 pl-6">
                        {/* Sets count */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Sets</span>
                          <button
                            className="w-5 h-5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center"
                            onClick={() => setSetRows(rows => rows.map((r, i) => i !== idx ? r : { ...r, rowCount: Math.max(1, r.rowCount - 1) }))}
                          >−</button>
                          <span className="text-xs tabular-nums text-slate-200 w-4 text-center">{set.rowCount}</span>
                          <button
                            className="w-5 h-5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center"
                            onClick={() => setSetRows(rows => rows.map((r, i) => i !== idx ? r : { ...r, rowCount: r.rowCount + 1 }))}
                          >+</button>
                        </div>

                        <span className="text-slate-700 text-xs">·</span>

                        {/* Rest stepper */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">Rest</span>
                          <button
                            className="w-5 h-5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center"
                            onClick={() => updateSet(idx, { restSeconds: Math.max(0, set.restSeconds - 15) })}
                          >−</button>
                          <span className="text-xs tabular-nums text-slate-200 w-10 text-center">
                            {set.restSeconds === 0 ? 'None' : `${set.restSeconds}s`}
                          </span>
                          <button
                            className="w-5 h-5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center"
                            onClick={() => updateSet(idx, { restSeconds: set.restSeconds + 15 })}
                          >+</button>
                          {set.restSeconds > 0 && (
                            <button
                              className="text-slate-500 hover:text-brand-400"
                              title="No rest"
                              onClick={() => updateSet(idx, { restSeconds: 0 })}
                            ><RotateCcw size={11} /></button>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                <button className="text-xs text-brand-400 flex items-center gap-1 mt-3" onClick={addOneSet}>
                  <Plus size={13} /> Add Set
                </button>
              </div>

              {/* Media */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">Images &amp; Videos</label>
                  {form.media.length > 0 && (
                    <span className="text-xs text-slate-500">{form.media.length} file{form.media.length !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={e => { handleFiles(e.target.files); setMediaPicker(null) }}
                />

                {/* Primary trigger button */}
                <button
                  className="btn-ghost w-full text-sm gap-2"
                  onClick={() => setMediaPicker(p => p === 'menu' ? null : 'menu')}
                >
                  <ImagePlus size={16} />
                  Add images or videos
                </button>

                {/* Options menu */}
                {mediaPicker === 'menu' && (
                  <div className="mt-2 rounded-xl border border-slate-700 overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 transition text-left"
                      onClick={() => { setMediaPicker(null); fileInputRef.current?.click() }}
                    >
                      <Upload size={16} className="text-brand-400 shrink-0" />
                      <div>
                        <p className="font-medium">Upload from device</p>
                        <p className="text-xs text-slate-500">Select files from your photos or storage</p>
                      </div>
                    </button>
                    <div className="h-px bg-slate-800" />
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 transition text-left"
                      onClick={() => setMediaPicker('url')}
                    >
                      <Link size={16} className="text-brand-400 shrink-0" />
                      <div>
                        <p className="font-medium">Add from URL</p>
                        <p className="text-xs text-slate-500">Paste a link to download the file</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* URL input */}
                {mediaPicker === 'url' && (
                  <div className="mt-2 p-3 rounded-xl border border-slate-700 bg-slate-800/50 space-y-2">
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        placeholder="https://example.com/image.jpg"
                        value={urlInput}
                        autoFocus
                        onChange={e => { setUrlInput(e.target.value); setUrlError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') fetchFromUrl() }}
                      />
                      <button
                        className="btn-primary text-sm shrink-0"
                        onClick={fetchFromUrl}
                        disabled={urlFetching || !urlInput.trim()}
                      >
                        {urlFetching ? <Loader2 size={15} className="animate-spin" /> : 'Fetch'}
                      </button>
                      <button
                        className="btn-ghost text-sm shrink-0"
                        onClick={() => { setMediaPicker(null); setUrlInput(''); setUrlError('') }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    {urlError && <p className="text-xs text-red-400">{urlError}</p>}
                  </div>
                )}

                <MediaGrid items={form.media} onRemove={removeMedia} onPreview={setLightbox} />
              </div>

              {/* Instructions */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Instructions (optional)</label>
                <textarea
                  className="input min-h-[72px] resize-none"
                  placeholder="Form cues, technique notes…"
                  value={form.instructions}
                  onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    className="input flex-1"
                    placeholder="compound, push…"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  />
                  <button className="btn-ghost" onClick={addTag}>Add</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.tags.map(t => (
                    <span key={t} className="chip gap-1">
                      {t}
                      <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky action bar so add/apply is always visible */}
            <div className="sticky bottom-0 -mx-5 mt-6 px-5 pt-3 pb-safe bg-slate-900/95 backdrop-blur border-t border-slate-800 flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={save}>
                {editId ? 'Apply Changes' : 'Add Exercise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
