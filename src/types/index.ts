// Core domain types for NotHevy

export type SetType = 'reps' | 'timed' | 'failure'

export type MuscleGroup = string
export type Equipment = string

export const DEFAULT_MUSCLE_GROUPS: string[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'traps', 'lats', 'full_body'
]

export const DEFAULT_EQUIPMENT: string[] = [
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight',
  'resistance_band', 'smith_machine', 'pull_up_bar', 'rings', 'other'
]

export type WeightUnit = 'kg' | 'lbs'

// ---------------------------------------------------------------------------
// Account types — schema foundation for future multi-account support
// ---------------------------------------------------------------------------
export type AuthProvider = 'local' | 'google' | 'apple' | 'github' | 'email'

export interface AppUser {
  id: string
  email?: string
  displayName?: string
  avatarUrl?: string
  createdAt: number
  lastLoginAt?: number
  isActive: boolean
}

export interface LinkedAuthAccount {
  id: string
  userId: string
  provider: AuthProvider
  providerAccountId: string
  createdAt: number
}

export interface UserSettingRow {
  id: string                 // `${userId}:${key}`
  userId: string
  key: string
  value: unknown
}

// ---------------------------------------------------------------------------
// ExerciseMedia — images and videos attached to an exercise, saved as files on
// disk (public/media/) and referenced by a local URL (e.g. /media/uuid.jpg).
// Nothing is stored in browser memory — all media lives on the local file system.
// ---------------------------------------------------------------------------
export interface ExerciseMedia {
  id: string
  type: 'image' | 'video'
  url: string       // local file URL served by Vite from public/media/
  mimeType: string
  name: string
  addedAt: number
}

// ---------------------------------------------------------------------------
// Exercise — atomic unit, user-defined
// ---------------------------------------------------------------------------
export interface Exercise {
  id: string
  ownerUserId?: string
  name: string
  muscleGroups: MuscleGroup[]
  equipment: Equipment[]
  defaultSetType: SetType
  defaultRestSeconds: number
  defaultSets: SetTarget[]        // saved set scheme; used to pre-fill template slots
  media: ExerciseMedia[]          // attached images / videos
  instructions?: string
  tags: string[]
  variations?: string[]           // e.g. ['Wide Grip', 'Close Grip', 'Incline']
  createdAt: number
}

// ---------------------------------------------------------------------------
// ExerciseSlot — an exercise as it appears inside a template or session
// ---------------------------------------------------------------------------
export interface SetTarget {
  id: string
  type: SetType
  reps?: number
  durationSeconds?: number
  weight?: number
  weightUnit: WeightUnit
  restSeconds: number
}

export interface ExerciseSlot {
  id: string
  exerciseId: string
  supersetGroupId?: string
  orderIndex: number
  sets: SetTarget[]
  notes?: string
  selectedVariation?: string      // chosen variation for this slot during a session
}

// ---------------------------------------------------------------------------
// WorkoutTemplate — reusable plan
// ---------------------------------------------------------------------------
export interface WorkoutTemplate {
  id: string
  ownerUserId?: string
  name: string
  description?: string
  tags: string[]
  slots: ExerciseSlot[]
  estimatedMinutes?: number
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// WorkoutSession — an instance of a template actually performed
// ---------------------------------------------------------------------------
export interface PerformedSet extends SetTarget {
  actualReps?: number
  actualDurationSeconds?: number
  actualWeight?: number
  actualRestSeconds?: number
  skipped: boolean
  completedAt?: number
}

export interface PerformedSlot extends Omit<ExerciseSlot, 'sets'> {
  sets: PerformedSet[]
}

export interface WorkoutSession {
  id: string
  ownerUserId?: string
  templateId?: string
  name: string
  startedAt: number
  completedAt?: number
  slots: PerformedSlot[]
  notes?: string
  totalVolumeKg: number
}

// ---------------------------------------------------------------------------
// PersonalRecord
// ---------------------------------------------------------------------------
export interface PersonalRecord {
  id: string
  ownerUserId?: string
  exerciseId: string
  type: '1rm' | 'max_reps_at_weight' | 'max_volume_session'
  value: number
  achievedAt: number
  sessionId: string
}

// ---------------------------------------------------------------------------
// Doc — user-created markdown document
// ---------------------------------------------------------------------------
export interface Doc {
  id: string
  title: string
  content: string   // raw markdown
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// AppSettings — key/value pairs stored in Dexie
// ---------------------------------------------------------------------------
export type AIProvider = 'claude' | 'openai' | 'openrouter'

export interface AppSettings {
  defaultWeightUnit: WeightUnit
  defaultRestSeconds: number
  defaultSetRowCount: number
  theme: 'dark' | 'light' | 'system'
  exerciseImagePreview: boolean
  aiProvider: AIProvider
  aiApiKey?: string
  aiModel?: string   // empty = use provider default
  muscleGroups?: string[]
  equipment?: string[]
}
