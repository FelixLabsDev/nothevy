import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, Pencil, Trash2, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { nanoid } from 'nanoid'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader'
import type { Doc } from '@/types'

export default function DocEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [saved, setSaved] = useState(true)

  // Load existing doc
  useEffect(() => {
    if (isNew) return
    db.docs.get(id!).then(doc => {
      if (!doc) { navigate('/docs', { replace: true }); return }
      setTitle(doc.title)
      setContent(doc.content)
    })
  }, [id, isNew, navigate])

  // Mark unsaved when content changes
  useEffect(() => { setSaved(false) }, [title, content])

  async function save() {
    const now = Date.now()
    if (isNew) {
      const doc: Doc = { id: nanoid(), title, content, createdAt: now, updatedAt: now }
      await db.docs.put(doc)
      setSaved(true)
      navigate(`/docs/${doc.id}`, { replace: true })
    } else {
      await db.docs.update(id!, { title, content, updatedAt: now })
      setSaved(true)
    }
  }

  async function deleteDoc() {
    if (!isNew) await db.docs.delete(id!)
    navigate('/docs', { replace: true })
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-4">
        <PageHeader
          title={isNew ? 'New Document' : 'Edit Document'}
          back
          actions={
            <div className="flex items-center gap-2">
              <button
                className={`p-2 rounded-xl transition ${preview ? 'bg-brand-500 text-slate-950' : 'hover:bg-slate-800 text-slate-400'}`}
                onClick={() => setPreview(v => !v)}
                title={preview ? 'Edit' : 'Preview'}
              >
                {preview ? <Pencil size={18} /> : <Eye size={18} />}
              </button>
              {!isNew && (
                <button
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
                  onClick={deleteDoc}
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                className="btn-primary flex items-center gap-1.5 text-sm"
                onClick={save}
                disabled={saved}
              >
                <Check size={15} />
                Save
              </button>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-auto px-4 pb-nav mb-nav flex flex-col gap-3">
        <input
          className="input text-base font-semibold"
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {preview ? (
          <div className="card flex-1 prose prose-invert prose-sm max-w-none min-h-40
                          prose-headings:text-slate-100 prose-p:text-slate-300
                          prose-strong:text-slate-100 prose-code:text-brand-400
                          prose-pre:bg-slate-800 prose-blockquote:border-brand-500
                          prose-a:text-brand-400 prose-li:text-slate-300
                          prose-hr:border-slate-700 prose-table:text-slate-300">
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-slate-500 italic">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <textarea
            className="input flex-1 resize-none font-mono text-sm leading-relaxed min-h-64"
            placeholder="Write in Markdown..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}
