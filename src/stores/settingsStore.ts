import { create } from 'zustand'
import { getAllSettings, setSetting } from '@/db'
import type { AppSettings } from '@/types'

// ---------------------------------------------------------------------------
// Settings store — wraps Dexie settings table, hydrated on app start
// ---------------------------------------------------------------------------
interface SettingsStore {
  settings: Partial<AppSettings>
  loaded: boolean
  load: () => Promise<void>
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loaded: false,

  load: async () => {
    const settings = await getAllSettings()
    // Apply defaults for first run
    const defaults: Partial<AppSettings> = {
      defaultWeightUnit: 'kg',
      defaultRestSeconds: 120,
      theme: 'dark',
      aiProvider: 'claude'
    }
    set({ settings: { ...defaults, ...settings }, loaded: true })
  },

  update: async (key, value) => {
    await setSetting(key, value)
    set(state => ({ settings: { ...state.settings, [key]: value } }))
  }
}))
