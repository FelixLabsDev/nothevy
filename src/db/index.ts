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
// Local file seed bootstrap — load data from committed public/local-db.json
// on first run when DB is empty.
// ---------------------------------------------------------------------------
type LocalDbSeed = {
  exercises?: Array<Omit<Exercise, 'media'> & { media?: Exercise['media'] }>
  templates?: WorkoutTemplate[]
  sessions?: WorkoutSession[]
  personalRecords?: PersonalRecord[]
  users?: AppUser[]
  linkedAuthAccounts?: LinkedAuthAccount[]
  userSettings?: UserSettingRow[]
  settings?: Record<string, unknown>
}

function normalizeExerciseMedia(exercise: Omit<Exercise, 'media'> & { media?: Exercise['media'] }): Exercise {
  return { ...exercise, media: exercise.media ?? [] }
}

export async function bootstrapDbFromLocalFile(path = '/local-db.json'): Promise<void> {
  const counts = await Promise.all([
    db.exercises.count(),
    db.templates.count(),
    db.sessions.count(),
    db.personalRecords.count(),
    db.settings.count()
  ])

  // If anything exists already, treat DB as initialized.
  if (counts.some(c => c > 0)) return

  try {
    const response = await fetch(path, { cache: 'no-store' })
    if (!response.ok) return
    const seed = await response.json() as LocalDbSeed

    if (seed.exercises?.length) await db.exercises.bulkPut(seed.exercises.map(normalizeExerciseMedia))
    if (seed.templates?.length) await db.templates.bulkPut(seed.templates)
    if (seed.sessions?.length) await db.sessions.bulkPut(seed.sessions)
    if (seed.personalRecords?.length) await db.personalRecords.bulkPut(seed.personalRecords)
    if (seed.users?.length) await db.users.bulkPut(seed.users)
    if (seed.linkedAuthAccounts?.length) await db.linkedAuthAccounts.bulkPut(seed.linkedAuthAccounts)
    if (seed.userSettings?.length) await db.userSettings.bulkPut(seed.userSettings)
    if (seed.settings) {
      const rows = Object.entries(seed.settings).map(([key, value]) => ({ key, value }))
      if (rows.length) await db.settings.bulkPut(rows)
    }
  } catch {
    // Ignore seed failures and continue with an empty DB.
  }
}
