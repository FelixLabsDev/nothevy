import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/settingsStore'
import { bootstrapDbFromLocalFile } from '@/db'
import BottomNav from '@/components/BottomNav'
import Dashboard from '@/pages/Dashboard'
import Exercises from '@/pages/Exercises'
import Templates from '@/pages/Templates'
import TemplateEditor from '@/pages/TemplateEditor'
import ActiveSession from '@/pages/ActiveSession'
import SessionRecap from '@/pages/SessionRecap'
import History from '@/pages/History'
import Settings from '@/pages/Settings'
import Docs from '@/pages/Docs'
import DocEditor from '@/pages/DocEditor'

export default function App() {
  const { load } = useSettingsStore()

  // Seed DB from committed local file on first run, then hydrate settings.
  useEffect(() => { void bootstrapDbFromLocalFile().then(load) }, [load])

  return (
    <div className="max-w-lg mx-auto min-h-screen relative">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/new" element={<TemplateEditor />} />
        <Route path="/templates/:id" element={<TemplateEditor />} />
        <Route path="/session/active" element={<ActiveSession />} />
        <Route path="/session/:id" element={<SessionRecap />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/:id" element={<DocEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
