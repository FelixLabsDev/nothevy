import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Trash2, Sparkles } from 'lucide-react'
import { db } from '@/db'
import { useActiveSessionStore } from '@/stores/sessionStore'
import PageHeader from '@/components/PageHeader'

export default function Templates() {
  const navigate = useNavigate()
  const { startSession } = useActiveSessionStore()

  const templates = useLiveQuery(
    () => db.templates.orderBy('updatedAt').reverse().toArray(),
    []
  )

  const handleStart = async (templateId: string) => {
    const template = await db.templates.get(templateId)
    if (!template) return
    startSession(template)
    navigate('/session/active')
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this template?')) await db.templates.delete(id)
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader
        title="Templates"
        actions={
          <button className="btn-primary text-sm" onClick={() => navigate('/templates/new')}>
            <Plus size={16} /> New
          </button>
        }
      />

      <div className="space-y-3">
        {templates?.map(t => (
          <div key={t.id} className="card">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0" onClick={() => navigate(`/templates/${t.id}`)}>
                <p className="font-semibold text-slate-100">{t.name}</p>
                {t.description && <p className="text-sm text-slate-400 mt-0.5 truncate">{t.description}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.tags.map(tag => <span key={tag} className="chip">{tag}</span>)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {t.slots.length} exercises · ~{t.estimatedMinutes ?? '?'} min
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="btn-danger p-2 rounded-xl"
                  onClick={() => handleDelete(t.id)}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className="btn-primary p-2 rounded-xl"
                  onClick={() => handleStart(t.id)}
                  title="Start"
                >
                  <Play size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {templates?.length === 0 && (
          <div className="card text-center py-12 text-slate-500">
            <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm mb-4">No templates yet.</p>
            <button className="btn-primary text-sm" onClick={() => navigate('/templates/new')}>
              <Plus size={16} /> Create Template
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
