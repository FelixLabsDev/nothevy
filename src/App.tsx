import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSettingsStore } from '@/stores/settingsStore'
import { loadFromFile, scheduleSyncToFile, syncToFile, _isLoading, db } from '@/db'
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

// ---------------------------------------------------------------------------
// SyncWatcher — uses useLiveQuery (reliable Dexie 4 change detection) to
// schedule a file sync whenever any table is mutated.
// Watches full arrays for tables that support in-place edits (exercises,
// templates, docs) and counts for append-only tables (sessions, PRs).
// ---------------------------------------------------------------------------
function SyncWatcher() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const templates = useLiveQuery(() => db.templates.toArray(), [])
  const docs      = useLiveQuery(() => db.docs.toArray(), [])
  const sessionCount = useLiveQuery(() => db.sessions.count(), [])
  const prCount      = useLiveQuery(() => db.personalRecords.count(), [])

  useEffect(() => {
    if (!_isLoading) scheduleSyncToFile()
  }, [exercises, templates, docs, sessionCount, prCount])

  return null
}

export default function App() {
  const { load } = useSettingsStore()

  // Load DB from local file on every startup, then hydrate settings.
  useEffect(() => { void loadFromFile().then(load) }, [load])

  // Expose syncToFile on window for emergency console access (dev only)
  useEffect(() => { (window as Record<string, unknown>).syncToFile = syncToFile }, [])

  return (
    <div className="max-w-lg mx-auto min-h-screen relative">
      <SyncWatcher />
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
