// Core domain types for NotHevy

export type SetType = 'reps' | 'timed' | 'failure'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'core' | 'traps' | 'lats' | 'full_body'

export type Equipment =
  | 'barbell' | 'dumbbell' | 'kettlebell'
  | 'cable' | 'machine' | 'bodyweight'
  | 'resistance_band' | 'smith_machine'
  | 'pull_up_bar' | 'rings' | 'other'

export type WeightUnit = 'kg' | 'lbs'

// ---------------------------------------------------------------------------
// ExerciseMedia — images and videos attached to an exercise, stored as Blobs
// ---------------------------------------------------------------------------
export interface ExerciseMedia {
  id: string
  type: 'image' | 'video'
  blob: Blob
  mimeType: string
  name: string
  addedAt: number
}

// ---------------------------------------------------------------------------
// Exercise — atomic unit, user-defined
// ---------------------------------------------------------------------------
export interface Exercise {
  id: string
  name: string
  muscleGroups: MuscleGroup[]
  equipment: Equipment[]
  defaultSetType: SetType
  defaultRestSeconds: number
  defaultSets: SetTarget[]        // saved set scheme; used to pre-fill template slots
  media: ExerciseMedia[]          // attached images / videos
  instructions?: string
  tags: string[]
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
}

// ---------------------------------------------------------------------------
// WorkoutTemplate — reusable plan
// ---------------------------------------------------------------------------
export interface WorkoutTemplate {
  id: string
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
  exerciseId: string
  type: '1rm' | 'max_reps_at_weight' | 'max_volume_session'
  value: number
  achievedAt: number
  sessionId: string
}

// ---------------------------------------------------------------------------
// AppSettings — key/value pairs stored in Dexie
// ---------------------------------------------------------------------------
export type AIProvider = 'claude' | 'openai' | 'openrouter'

export interface AppSettings {
  defaultWeightUnit: WeightUnit
  defaultRestSeconds: number
  theme: 'dark' | 'light' | 'system'
  aiProvider: AIProvider
  aiApiKey?: string
  aiModel?: string   // empty = use provider default
}
