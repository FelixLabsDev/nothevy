import { useEffect, useState } from 'react'
import { Moon, Dumbbell, Clock, Eye, EyeOff, Bot, Download } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { db } from '@/db'
import PageHeader from '@/components/PageHeader'
import type { AIProvider } from '@/types'

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
  const [exercises, templates, sessions, personalRecords, users, linkedAuthAccounts, userSettings, settingsRows] = await Promise.all([
    db.exercises.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.personalRecords.toArray(),
    db.users.toArray(),
    db.linkedAuthAccounts.toArray(),
    db.userSettings.toArray(),
    db.settings.toArray()
  ])

  const seed = {
    meta: { name: 'NotHevy Local DB Seed', version: 2 },
    // Blobs cannot be represented in JSON — strip media attachments from exercises
    exercises: exercises.map(e => ({ ...e, media: [] })),
    templates,
    sessions,
    personalRecords,
    users,
    linkedAuthAccounts,
    userSettings,
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

  const [showKey, setShowKey] = useState(false)
  const [keyInput, setKeyInput] = useState(settings.aiApiKey ?? '')
  const [modelInput, setModelInput] = useState(settings.aiModel ?? '')

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
        {/* Weight unit */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Dumbbell size={18} className="text-brand-400" />
            <span className="font-semibold">Default Weight Unit</span>
          </div>
          <div className="flex gap-3">
            {(['kg', 'lbs'] as const).map(unit => (
              <button
                key={unit}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition ${
                  settings.defaultWeightUnit === unit
                    ? 'bg-brand-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => update('defaultWeightUnit', unit)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>

        {/* Default rest */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Clock size={18} className="text-brand-400" />
            <span className="font-semibold">Default Rest</span>
          </div>
          {/* +/-15 stepper */}
          <div className="flex items-center gap-3 mb-3">
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultRestSeconds', Math.max(0, (settings.defaultRestSeconds ?? 120) - 15))}
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-3xl font-bold tabular-nums">
                {settings.defaultRestSeconds === 0 ? 'None' : `${settings.defaultRestSeconds ?? 120}s`}
              </p>
            </div>
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultRestSeconds', (settings.defaultRestSeconds ?? 120) + 15)}
            >+</button>
          </div>
          {/* Quick presets */}
          <div className="flex gap-2">
            {[0, 60, 90, 120, 180].map(s => (
              <button
                key={s}
                className={`flex-1 py-1.5 rounded-lg font-medium text-xs transition ${
                  settings.defaultRestSeconds === s
                    ? 'bg-brand-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                onClick={() => update('defaultRestSeconds', s)}
              >
                {s === 0 ? 'None' : `${s}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Default sets per row */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Dumbbell size={18} className="text-brand-400" />
            <span className="font-semibold">Default Sets Per Row</span>
          </div>
          {/* +/-1 stepper */}
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultSetRowCount', Math.max(1, (settings.defaultSetRowCount ?? 3) - 1))}
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-3xl font-bold tabular-nums">{settings.defaultSetRowCount ?? 3}</p>
            </div>
            <button
              className="btn-ghost w-12 h-12 text-lg font-bold shrink-0"
              onClick={() => update('defaultSetRowCount', (settings.defaultSetRowCount ?? 3) + 1)}
            >+</button>
          </div>
        </div>

        {/* Theme */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <Moon size={18} className="text-brand-400" />
            <span className="font-semibold">Theme</span>
          </div>
          <div className="flex gap-3">
            {(['dark', 'light', 'system'] as const).map(t => (
              <button
                key={t}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm capitalize transition ${
                  settings.theme === t
                    ? 'bg-brand-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                onClick={() => update('theme', t)}
              >
                {t}
              </button>
            ))}
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
