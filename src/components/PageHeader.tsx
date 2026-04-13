import { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  back?: boolean
  actions?: ReactNode
}

export default function PageHeader({ title, back, actions }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="flex items-center gap-3 px-4 pt-safe pt-6 pb-4">
      {back && (
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="flex-1 text-xl font-bold truncate">{title}</h1>
      {actions}
    </header>
  )
}
