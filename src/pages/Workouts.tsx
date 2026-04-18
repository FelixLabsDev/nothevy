import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Trash2, Pencil, Layers } from 'lucide-react'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader'

export default function Workouts() {
  const navigate = useNavigate()
  const workouts = useLiveQuery(() => db.workouts.orderBy('updatedAt').reverse().toArray(), [])
  const templates = useLiveQuery(() => db.templates.toArray(), [])

  const estMinutes = (templateIds: string[]) => {
    if (!templates?.length) return '?'
    let sum = 0
    let any = false
    for (const id of templateIds) {
      const t = templates.find(x => x.id === id)
      if (t?.estimatedMinutes != null) { sum += t.estimatedMinutes; any = true }
    }
    return any ? String(sum) : '?'
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this workout?')) await db.workouts.delete(id)
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader
        title="Workouts"
        actions={
          <button className="btn-primary text-sm" onClick={() => navigate('/workouts/new')}>
            <Plus size={16} /> New
          </button>
        }
      />

      <div className="space-y-3">
        {workouts?.map(w => (
          <div key={w.id} className="card">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0" onClick={() => navigate(`/workouts/${w.id}`)}>
                <p className="font-semibold text-slate-100">{w.name}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {w.tags.map(tag => <span key={tag} className="chip">{tag}</span>)}
                </div>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Layers size={12} />
                  {w.templateIds.length} template{w.templateIds.length !== 1 ? 's' : ''} · ~{estMinutes(w.templateIds)} min
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-ghost p-2 rounded-xl" title="Edit" onClick={() => navigate(`/workouts/${w.id}`)}>
                  <Pencil size={16} />
                </button>
                <button className="btn-danger p-2 rounded-xl" title="Delete" onClick={() => handleDelete(w.id)}>
                  <Trash2 size={16} />
                </button>
                <button className="btn-primary p-2 rounded-xl" title="Start" onClick={() => navigate(`/workouts/${w.id}/setup`)}>
                  <Play size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {workouts?.length === 0 && (
          <div className="card text-center py-12 text-slate-500">
            <Layers size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm mb-4">No workouts yet. Combine templates into a single plan.</p>
            <button className="btn-primary text-sm" onClick={() => navigate('/workouts/new')}>
              <Plus size={16} /> Create workout
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
