import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, ChevronRight } from 'lucide-react'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader'

export default function Docs() {
  const navigate = useNavigate()
  const docs = useLiveQuery(() => db.docs.orderBy('updatedAt').reverse().toArray(), [])

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader
        title="Docs"
        actions={
          <button
            className="btn-primary flex items-center gap-1.5 text-sm"
            onClick={() => navigate('/docs/new')}
          >
            <Plus size={16} />
            New
          </button>
        }
      />

      {docs?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 mt-20 text-slate-500">
          <FileText size={40} strokeWidth={1.2} />
          <p className="text-sm">No documents yet. Create one to get started.</p>
        </div>
      )}

      <div className="space-y-2">
        {docs?.map(doc => (
          <button
            key={doc.id}
            className="card w-full text-left flex items-center gap-3 hover:bg-slate-800 transition"
            onClick={() => navigate(`/docs/${doc.id}`)}
          >
            <FileText size={18} className="text-brand-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{doc.title || 'Untitled'}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </p>
            </div>
            <ChevronRight size={16} className="text-slate-600 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
