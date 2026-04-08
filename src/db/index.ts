import Dexie, { type Table } from 'dexie'
import type { Exercise, WorkoutTemplate, WorkoutSession, PersonalRecord, AppUser, LinkedAuthAccount, UserSettingRow, Doc } from '@/types'

// ---------------------------------------------------------------------------
// Dexie database — single source of truth for all local data
// ---------------------------------------------------------------------------
class NotHevyDB extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<WorkoutTemplate, string>
  sessions!: Table<WorkoutSession, string>
  personalRecords!: Table<PersonalRecord, string>
  settings!: Table<{ key: string; value: unknown }, string>
  users!: Table<AppUser, string>
  linkedAuthAccounts!: Table<LinkedAuthAccount, string>
  userSettings!: Table<UserSettingRow, string>
  docs!: Table<Doc, string>

  constructor() {
    super('NotHevyDB')
    this.version(1).stores({
      exercises:       'id, name, *muscleGroups, *tags, createdAt',
      templates:       'id, name, *tags, updatedAt',
      sessions:        'id, templateId, startedAt, completedAt',
      personalRecords: 'id, exerciseId, type, achievedAt',
      settings:        'key'
    })

    // Account-ready schema extension
    this.version(2).stores({
      exercises:          'id, ownerUserId, name, *muscleGroups, *tags, createdAt',
      templates:          'id, ownerUserId, name, *tags, updatedAt',
      sessions:           'id, ownerUserId, templateId, startedAt, completedAt',
      personalRecords:    'id, ownerUserId, exerciseId, type, achievedAt',
      settings:           'key',
      users:              'id, email, isActive, createdAt, lastLoginAt',
      linkedAuthAccounts: 'id, userId, provider, providerAccountId, [provider+providerAccountId]',
      userSettings:       'id, userId, key, [userId+key]'
    }).upgrade(async tx => {
      const defaultUserId = 'local-default'

      // Ensure a default local user exists so current single-user data has an owner.
      const usersTable = tx.table('users')
      const existingDefaultUser = await usersTable.get(defaultUserId)
      if (!existingDefaultUser) {
        await usersTable.put({
          id: defaultUserId,
          displayName: 'Local User',
          createdAt: Date.now(),
          isActive: true
        } satisfies AppUser)
      }

      // Backfill ownerUserId for legacy rows to preserve deterministic ownership.
      await tx.table('exercises').toCollection().modify((row: Exercise) => { if (!row.ownerUserId) row.ownerUserId = defaultUserId })
      await tx.table('templates').toCollection().modify((row: WorkoutTemplate) => { if (!row.ownerUserId) row.ownerUserId = defaultUserId })
      await tx.table('sessions').toCollection().modify((row: WorkoutSession) => { if (!row.ownerUserId) row.ownerUserId = defaultUserId })
      await tx.table('personalRecords').toCollection().modify((row: PersonalRecord) => { if (!row.ownerUserId) row.ownerUserId = defaultUserId })
    })

    // Docs table
    this.version(3).stores({
      exercises:          'id, ownerUserId, name, *muscleGroups, *tags, createdAt',
      templates:          'id, ownerUserId, name, *tags, updatedAt',
      sessions:           'id, ownerUserId, templateId, startedAt, completedAt',
      personalRecords:    'id, ownerUserId, exerciseId, type, achievedAt',
      settings:           'key',
      users:              'id, email, isActive, createdAt, lastLoginAt',
      linkedAuthAccounts: 'id, userId, provider, providerAccountId, [provider+providerAccountId]',
      userSettings:       'id, userId, key, [userId+key]',
      docs:               'id, title, updatedAt'
    })
  }
}

export const db = new NotHevyDB()

// ---------------------------------------------------------------------------
// Auto-sync state — managed externally by SyncWatcher (React component).
// _isLoading flag prevents sync during loadFromFile() bulk writes.
// ---------------------------------------------------------------------------
export let _isLoading = false
let _syncTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSyncToFile() {
  if (_isLoading) return
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => void syncToFile(), 800)
}

// Expose manual trigger on window for emergency console access
if (typeof window !== 'undefined') (window as Record<string, unknown>).syncToFile = () => syncToFile()

// ---------------------------------------------------------------------------
// Settings helpers — typed get/set wrappers
// ---------------------------------------------------------------------------
export async function getSetting<K extends keyof import('@/types').AppSettings>(
  key: K
): Promise<import('@/types').AppSettings[K] | undefined> {
  const row = await db.settings.get(key)
  return row?.value as import('@/types').AppSettings[K] | undefined
}

export async function setSetting<K extends keyof import('@/types').AppSettings>(
  key: K,
  value: import('@/types').AppSettings[K]
): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getAllSettings(): Promise<Partial<import('@/types').AppSettings>> {
  const rows = await db.settings.toArray()
  return Object.fromEntries(rows.map(r => [r.key, r.value])) as Partial<import('@/types').AppSettings>
}

// ---------------------------------------------------------------------------
// DB seed shape — shared by loadFromFile and syncToFile
// ---------------------------------------------------------------------------
type LocalDbSeed = {
  meta?: { name: string; version: number }
  exercises?: Array<Omit<Exercise, 'media'> & { media?: Exercise['media'] }>
  templates?: WorkoutTemplate[]
  sessions?: WorkoutSession[]
  personalRecords?: PersonalRecord[]
  users?: AppUser[]
  linkedAuthAccounts?: LinkedAuthAccount[]
  userSettings?: UserSettingRow[]
  settings?: Record<string, unknown>
  docs?: Doc[]
}

function normalizeExerciseMedia(exercise: Omit<Exercise, 'media'> & { media?: Exercise['media'] }): Exercise {
  return { ...exercise, media: exercise.media ?? [] }
}

// ---------------------------------------------------------------------------
// loadFromFile — always loads fresh from /api/db (local file via API server).
// Falls back to the static public/local-db.json seed on first run only if the
// API server is unavailable (e.g. production build / PWA).
// ---------------------------------------------------------------------------
export async function loadFromFile(): Promise<void> {
  try {
    const response = await fetch('/api/db', { cache: 'no-store' })
    if (!response.ok) throw new Error('API not available')
    const seed = await response.json() as LocalDbSeed

    // Pause sync hooks to avoid re-entrant writes during the reload
    _isLoading = true
    try {
      await db.transaction('rw', [
        db.exercises, db.templates, db.sessions, db.personalRecords,
        db.settings, db.users, db.linkedAuthAccounts, db.userSettings, db.docs
      ], async () => {
        await Promise.all([
          db.exercises.clear(), db.templates.clear(), db.sessions.clear(),
          db.personalRecords.clear(), db.settings.clear(), db.users.clear(),
          db.linkedAuthAccounts.clear(), db.userSettings.clear(), db.docs.clear()
        ])
        if (seed.exercises?.length) await db.exercises.bulkPut(seed.exercises.map(normalizeExerciseMedia))
        if (seed.templates?.length) await db.templates.bulkPut(seed.templates)
        if (seed.sessions?.length) await db.sessions.bulkPut(seed.sessions)
        if (seed.personalRecords?.length) await db.personalRecords.bulkPut(seed.personalRecords)
        if (seed.users?.length) await db.users.bulkPut(seed.users)
        if (seed.linkedAuthAccounts?.length) await db.linkedAuthAccounts.bulkPut(seed.linkedAuthAccounts)
        if (seed.userSettings?.length) await db.userSettings.bulkPut(seed.userSettings)
        if (seed.docs?.length) await db.docs.bulkPut(seed.docs)
        if (seed.settings) {
          const rows = Object.entries(seed.settings).map(([key, value]) => ({ key, value }))
          if (rows.length) await db.settings.bulkPut(rows)
        }
      })
    } finally {
      _isLoading = false
    }
  } catch {
    // API server not available — fall back to static seed file (first-run only)
    await _bootstrapFromStaticSeed()
  }
}

// Fallback: full clear-and-reload from the static public file.
// Used when the API server is unreachable (e.g. PWA / offline).
// Always overwrites so a phone with stale IndexedDB data gets updated too.
async function _bootstrapFromStaticSeed(): Promise<void> {
  try {
    const response = await fetch('/local-db.json', { cache: 'no-store' })
    if (!response.ok) return
    const seed = await response.json() as LocalDbSeed

    _isLoading = true
    try {
      await db.transaction('rw', [
        db.exercises, db.templates, db.sessions, db.personalRecords,
        db.settings, db.users, db.linkedAuthAccounts, db.userSettings, db.docs
      ], async () => {
        await Promise.all([
          db.exercises.clear(), db.templates.clear(), db.sessions.clear(),
          db.personalRecords.clear(), db.settings.clear(), db.users.clear(),
          db.linkedAuthAccounts.clear(), db.userSettings.clear(), db.docs.clear()
        ])
        if (seed.exercises?.length) await db.exercises.bulkPut(seed.exercises.map(normalizeExerciseMedia))
        if (seed.templates?.length) await db.templates.bulkPut(seed.templates)
        if (seed.sessions?.length) await db.sessions.bulkPut(seed.sessions)
        if (seed.personalRecords?.length) await db.personalRecords.bulkPut(seed.personalRecords)
        if (seed.users?.length) await db.users.bulkPut(seed.users)
        if (seed.linkedAuthAccounts?.length) await db.linkedAuthAccounts.bulkPut(seed.linkedAuthAccounts)
        if (seed.userSettings?.length) await db.userSettings.bulkPut(seed.userSettings)
        if (seed.docs?.length) await db.docs.bulkPut(seed.docs)
        if (seed.settings) {
          const rows = Object.entries(seed.settings).map(([key, value]) => ({ key, value }))
          if (rows.length) await db.settings.bulkPut(rows)
        }
      })
    } finally {
      _isLoading = false
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// syncToFile — dumps all Dexie tables and POSTs to /api/db (local file).
// Called automatically via debounced hooks after every write.
// ---------------------------------------------------------------------------
export async function syncToFile(): Promise<void> {
  try {
    const [exercises, templates, sessions, personalRecords, users, linkedAuthAccounts, userSettings, settingsRows, docs] = await Promise.all([
      db.exercises.toArray(), db.templates.toArray(), db.sessions.toArray(),
      db.personalRecords.toArray(), db.users.toArray(), db.linkedAuthAccounts.toArray(),
      db.userSettings.toArray(), db.settings.toArray(), db.docs.toArray()
    ])

    const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]))
    const payload: LocalDbSeed = {
      meta: { name: 'NotHevyDB', version: 3 },
      exercises, templates, sessions, personalRecords,
      users, linkedAuthAccounts, userSettings, settings, docs
    }

    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload, null, 2)
    })
  } catch { /* ignore if API server unavailable */ }
}
