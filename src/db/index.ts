import Dexie, { type Table } from 'dexie'
import type { Exercise, WorkoutTemplate, WorkoutSession, PersonalRecord } from '@/types'

// ---------------------------------------------------------------------------
// Dexie database — single source of truth for all local data
// ---------------------------------------------------------------------------
class NotHevyDB extends Dexie {
  exercises!: Table<Exercise, string>
  templates!: Table<WorkoutTemplate, string>
  sessions!: Table<WorkoutSession, string>
  personalRecords!: Table<PersonalRecord, string>
  settings!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('NotHevyDB')
    this.version(1).stores({
      exercises:       'id, name, *muscleGroups, *tags, createdAt',
      templates:       'id, name, *tags, updatedAt',
      sessions:        'id, templateId, startedAt, completedAt',
      personalRecords: 'id, exerciseId, type, achievedAt',
      settings:        'key'
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
