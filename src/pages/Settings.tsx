import { useEffect, useState } from 'react'
import { Moon, Dumbbell, Eye, EyeOff, Bot, Download, X, Plus, RotateCcw, ChevronRight, Palette, Image } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '@/stores/settingsStore'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader'
import type { AIProvider } from '@/types'
import { DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT } from '@/types'

// Default model placeholder shown per provider when no custom model is set
const PROVIDER_DEFAULTS: Record<AIProvider, string> = {
  claude:     'claude-opus-4-5',
  openai:     'gpt-4o',
  openrouter: 'anthropic/claude-opus-4-5'
}

const PROVIDER_KEY_HINTS: Record<AIProvider, string> = {
  claude:     'sk-ant-api03-…',
  openai:     'sk-…',
  openrouter: 'sk-or-v1-…'
}

const PROVIDERS: { id: AIProvider; label: string }[] = [
  { id: 'claude',     label: 'Claude' },
  { id: 'openai',     label: 'OpenAI' },
  { id: 'openrouter', label: 'OpenRouter' }
]

// ---------------------------------------------------------------------------
// Export full DB to downloadable local-db.json seed file
// ---------------------------------------------------------------------------
async function exportDbSeed(): Promise<void> {
  const [exercises, templates, sessions, personalRecords, users, linkedAuthAccounts, userSettings, settingsRows, docs, workouts] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.personalRecords.toArray(),
    db.users.toArray(),
    db.linkedAuthAccounts.toArray(),
    db.userSettings.toArray(),
    db.settings.toArray(),
    db.docs.toArray(),
    db.workouts.toArray()
  ])

  const seed = {
    meta: { name: 'NotHevy Local DB Seed', version: 4 },
    // Blobs cannot be represented in JSON — strip media attachments from exercises
    exercises: exercises.map(e => ({ ...e, media: [] })),
    templates,
    sessions,
    personalRecords,
    users,
    linkedAuthAccounts,
    userSettings,
    docs,
    workouts,
    settings: Object.fromEntries(settingsRows.map(r => [r.key, r.value]))
  }

  const blob = new Blob([JSON.stringify(seed, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'local-db.json'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Settings() {
  const { settings, update } = useSettingsStore()
  const navigate = useNavigate()

  const [showKey, setShowKey] = useState(false)
  const [keyInput, setKeyInput] = useState(settings.aiApiKey ?? '')
  const [modelInput, setModelInput] = useState(settings.aiModel ?? '')
  const [muscleInput, setMuscleInput] = useState('')
  const [equipmentInput, setEquipmentInput] = useState('')

  const currentMuscles = settings.muscleGroups ?? DEFAULT_MUSCLE_GROUPS
  const currentEquipment = settings.equipment ?? DEFAULT_EQUIPMENT

  const addMuscle = () => {
    const val = muscleInput.trim().toLowerCase().replace(/\s+/g, '_')
    if (!val || currentMuscles.includes(val)) return
    update('muscleGroups', [...currentMuscles, val])
    setMuscleInput('')
  }
  const removeMuscle = (m: string) =>
    update('muscleGroups', currentMuscles.filter(x => x !== m))

  const addEquipment = () => {
    const val = equipmentInput.trim().toLowerCase().replace(/\s+/g, '_')
    if (!val || currentEquipment.includes(val)) return
    update('equipment', [...currentEquipment, val])
    setEquipmentInput('')
  }
  const removeEquipment = (e: string) =>
    update('equipment', currentEquipment.filter(x => x !== e))

  // Keep inputs in sync when settings hydrate from DB
  useEffect(() => { setKeyInput(settings.aiApiKey ?? '') }, [settings.aiApiKey])
  useEffect(() => { setModelInput(settings.aiModel ?? '') }, [settings.aiModel])

  const saveAI = () => {
    update('aiApiKey', keyInput.trim())
    update('aiModel', modelInput.trim() || undefined)
  }

  return (
    <div className="px-4 pb-nav mb-nav">
      <PageHeader title="Settings" />

      <div className="space-y-4">
        {/* Defaults */}
        <button
          className="card w-full flex items-center gap-3 hover:bg-slate-800 transition text-left"
          onClick={() => navigate('/settings/defaults')}
        >
          <Dumbbell size={18} className="text-brand-400 shrink-0" />
          <span className="flex-1 font-semibold">Defaults</span>
          <ChevronRight size={16} className="text-slate-500" />
        </button>

        {/* Visual */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Palette size={18} className="text-brand-400" />
            <span className="font-semibold">Visual</span>
          </div>

          {/* Theme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Moon size={14} className="text-[var(--text-dim)]" />
              <span className="text-sm text-[var(--text-lo)]">Theme</span>
            </div>
            <div className="flex gap-3">
              {(['dark', 'light', 'system'] as const).map(t => (
                <button
                  key={t}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm capitalize transition ${
                    settings.theme === t
                      ? 'bg-brand-500 text-slate-950'
                      : 'bg-[var(--bg-el)] text-[var(--text-lo)] hover:bg-[var(--bg-hover)]'
                  }`}
                  onClick={() => {
                    update('theme', t)
                    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
                    document.documentElement.classList.toggle('dark', isDark)
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise image preview */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image size={14} className="text-[var(--text-dim)]" />
              <span className="text-sm text-[var(--text-lo)]">Exercise image preview</span>
            </div>
            <button
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.exerciseImagePreview !== false ? 'bg-brand-500' : 'bg-[var(--bg-el)]'
              }`}
              onClick={() => update('exerciseImagePreview', settings.exerciseImagePreview === false ? true : false)}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings.exerciseImagePreview !== false ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* AI provider + model + key */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Bot size={18} className="text-brand-400" />
            <span className="font-semibold">AI Provider</span>
          </div>

          {/* Provider selector */}
          <div className="flex gap-2">
            {PROVIDERS.map(({ id, label }) => (
              <button
                key={id}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition ${
                  settings.aiProvider === id
                    ? 'bg-brand-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => update('aiProvider', id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Model */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Model</label>
            <input
              className="input text-sm"
              placeholder={`Default: ${PROVIDER_DEFAULTS[settings.aiProvider ?? 'claude']}`}
              value={modelInput}
              onChange={e => setModelInput(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">Leave blank to use the provider default.</p>
          </div>

          {/* API key */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  className="input pr-10 text-sm"
                  type={showKey ? 'text' : 'password'}
                  placeholder={PROVIDER_KEY_HINTS[settings.aiProvider ?? 'claude']}
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  onClick={() => setShowKey(v => !v)}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button className="btn-primary text-sm shrink-0" onClick={saveAI}>Save</button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Stored locally in IndexedDB only — never sent to any server other than the provider.
            </p>
          </div>
        </div>

        {/* Muscle groups */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Dumbbell size={18} className="text-brand-400" />
              <span className="font-semibold">Muscle Groups</span>
            </div>
            <button
              className="text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1"
              onClick={() => update('muscleGroups', DEFAULT_MUSCLE_GROUPS)}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {currentMuscles.map(m => (
              <span key={m} className="chip gap-1">
                {m.replace(/_/g, ' ')}
                <button onClick={() => removeMuscle(m)} className="text-slate-500 hover:text-red-400">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="e.g. neck"
              value={muscleInput}
              onChange={e => setMuscleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMuscle() } }}
            />
            <button className="btn-ghost text-sm shrink-0" onClick={addMuscle}>
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {/* Equipment */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Dumbbell size={18} className="text-brand-400" />
              <span className="font-semibold">Equipment</span>
            </div>
            <button
              className="text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1"
              onClick={() => update('equipment', DEFAULT_EQUIPMENT)}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {currentEquipment.map(eq => (
              <span key={eq} className="chip gap-1">
                {eq.replace(/_/g, ' ')}
                <button onClick={() => removeEquipment(eq)} className="text-slate-500 hover:text-red-400">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="e.g. trap bar"
              value={equipmentInput}
              onChange={e => setEquipmentInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEquipment() } }}
            />
            <button className="btn-ghost text-sm shrink-0" onClick={addEquipment}>
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {/* Export DB seed */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Download size={18} className="text-brand-400" />
            <span className="font-semibold">Export DB Seed</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Downloads your current exercises, templates and settings as <code className="text-brand-400">local-db.json</code>.
            Replace <code className="text-slate-300">public/local-db.json</code> with this file and commit it to seed fresh installs.
            Attached media is excluded (blobs cannot be stored in JSON).
          </p>
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={exportDbSeed}>
            <Download size={15} />
            Download local-db.json
          </button>
        </div>

        <p className="text-center text-xs text-slate-600">NotHevy v0.4.0</p>
      </div>
    </div>
  )
}
