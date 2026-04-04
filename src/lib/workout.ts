import { nanoid } from 'nanoid'
import { db } from '@/db'
import type { Exercise, WorkoutTemplate, WorkoutSession, PerformedSet, PersonalRecord } from '@/types'

// ---------------------------------------------------------------------------
// Volume helpers
// ---------------------------------------------------------------------------

/** Estimate 1-rep max using the Epley formula */
export function calc1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Sum of (weight × reps) for all completed sets in a session */
export function calcSessionVolume(session: WorkoutSession): number {
  let total = 0
  for (const slot of session.slots) {
    for (const set of slot.sets) {
      if (!set.skipped && set.actualWeight && set.actualReps) {
        const kg = set.weightUnit === 'lbs' ? set.actualWeight * 0.453592 : set.actualWeight
        total += kg * set.actualReps
      }
    }
  }
  return Math.round(total * 10) / 10
}

// ---------------------------------------------------------------------------
// PR detection — run after a session is saved
// ---------------------------------------------------------------------------
export async function detectAndSavePRs(session: WorkoutSession): Promise<PersonalRecord[]> {
  const newPRs: PersonalRecord[] = []

  for (const slot of session.slots) {
    for (const set of slot.sets) {
      if (set.skipped || !set.actualWeight || !set.actualReps) continue

      const weight = set.weightUnit === 'lbs' ? set.actualWeight * 0.453592 : set.actualWeight
      const estimated1RM = calc1RM(weight, set.actualReps)

      // Check against existing 1RM for this exercise
      const existing = await db.personalRecords
        .where({ exerciseId: slot.exerciseId, type: '1rm' })
        .first()

      if (!existing || estimated1RM > existing.value) {
        const pr: PersonalRecord = {
          id: nanoid(),
          exerciseId: slot.exerciseId,
          type: '1rm',
          value: Math.round(estimated1RM * 10) / 10,
          achievedAt: session.completedAt ?? Date.now(),
          sessionId: session.id
        }
        await db.personalRecords.put(pr)
        newPRs.push(pr)
      }
    }
  }

  return newPRs
}

// ---------------------------------------------------------------------------
// Progressive overload — get suggestion for an exercise based on last session
// ---------------------------------------------------------------------------
export async function getProgressionSuggestion(
  exerciseId: string
): Promise<{ weight: number; reps: number; unit: 'kg' | 'lbs' } | null> {
  // Find all past sessions containing this exercise, sorted newest first
  const allSessions = await db.sessions.where('completedAt').above(0).reverse().sortBy('completedAt')

  for (const session of allSessions) {
    const slot = session.slots.find(s => s.exerciseId === exerciseId)
    if (!slot) continue

    const completedSets = slot.sets.filter(s => !s.skipped && s.actualWeight && s.actualReps)
    if (!completedSets.length) continue

    // Use the best set (highest weight × reps) as reference
    const best = completedSets.reduce<PerformedSet>((a, b) => {
      const aVol = (a.actualWeight ?? 0) * (a.actualReps ?? 0)
      const bVol = (b.actualWeight ?? 0) * (b.actualReps ?? 0)
      return bVol > aVol ? b : a
    }, completedSets[0])

    const unit = best.weightUnit
    const increment = unit === 'kg' ? 2.5 : 5
    return {
      weight: (best.actualWeight ?? 0) + increment,
      reps: best.actualReps ?? 0,
      unit
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Nanoid re-export for consistent ID generation
// ---------------------------------------------------------------------------
export { nanoid }

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------
export function isExercise(v: unknown): v is Exercise { return typeof v === 'object' && v !== null && 'muscleGroups' in v }
export function isTemplate(v: unknown): v is WorkoutTemplate { return typeof v === 'object' && v !== null && 'slots' in v && 'updatedAt' in v }
