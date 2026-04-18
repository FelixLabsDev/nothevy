import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { db } from '@/db'
import { nanoid } from '@/lib/workout'
import PageHeader from '@/components/PageHeader'
import type { Workout } from '@/types'

export default function WorkoutEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const existing = useLiveQuery<Workout | undefined>(() => (id ? db.workouts.get(id) : Promise.resolve(undefined)), [id])
  const allTemplates = useLiveQuery(() => db.templates.orderBy('name').toArray(), [])

  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [templateIds, setTemplateIds] = useState<string[]>([])
  const [addTemplateId, setAddTemplateId] = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setTags(existing.tags)
      setTemplateIds(existing.templateIds)
    }
  }, [existing])

  const save = async () => {
    if (!name.trim()) return
    const now = Date.now()
    const row: Workout = {
      id: id ?? nanoid(),
      name: name.trim(),
      tags,
      templateIds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    await db.workouts.put(row)
    navigate('/workouts')
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(ts => [...ts, t])
    setTagInput('')
  }

  const addTemplate = () => {
    if (!addTemplateId || templateIds.includes(addTemplateId)) return
    setTemplateIds(ids => [...ids, addTemplateId])
    setAddTemplateId('')
  }

  const moveTemplate = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= templateIds.length) return
    setTemplateIds(ids => {
      const next = [...ids]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  const removeTemplate = (idx: number) => setTemplateIds(ids => ids.filter((_, i) => i !== idx))

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title={isNew ? 'New Workout' : 'Edit Workout'} back actions={<button className="btn-primary text-sm" onClick={save}>Save</button>} />

      <div className="space-y-3 mb-5">
        <input className="input" placeholder="Workout name *" value={name} onChange={e => setName(e.target.value)} />
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" placeholder="Tag" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} />
          <button className="btn-ghost text-sm" onClick={addTag}>+</button>
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

      <p className="text-xs text-slate-500 mb-2">Templates run in this order when you start the workout.</p>

      <div className="space-y-2 mb-4">
        {templateIds.map((tid, i) => {
          const t = allTemplates?.find(x => x.id === tid)
          return (
            <div key={`${tid}-${i}`} className="card flex items-center gap-2">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button className="p-0.5 rounded hover:bg-slate-700 text-slate-500" onClick={() => moveTemplate(i, -1)} disabled={i === 0}><ChevronUp size={16} /></button>
                <button className="p-0.5 rounded hover:bg-slate-700 text-slate-500" onClick={() => moveTemplate(i, 1)} disabled={i === templateIds.length - 1}><ChevronDown size={16} /></button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{t?.name ?? tid}</p>
                <p className="text-xs text-slate-500">{t?.slots.length ?? 0} exercises</p>
              </div>
              <button className="p-2 text-slate-500 hover:text-red-400" onClick={() => removeTemplate(i)}><Trash2 size={16} /></button>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <select className="input flex-1 text-sm" value={addTemplateId} onChange={e => setAddTemplateId(e.target.value)}>
          <option value="">— Add template —</option>
          {allTemplates?.filter(t => !templateIds.includes(t.id)).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button className="btn-primary shrink-0" onClick={addTemplate} disabled={!addTemplateId}><Plus size={16} /></button>
      </div>
    </div>
  )
}
