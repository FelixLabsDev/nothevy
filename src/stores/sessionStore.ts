import { create } from 'zustand'
import { nanoid } from '@/lib/workout'
import type { WorkoutSession, PerformedSlot, PerformedSet, WorkoutTemplate, ExerciseSlot, DifficultyRating } from '@/types'
import { db } from '@/db'
import { calcSessionVolume, detectAndSavePRs } from '@/lib/workout'

// Map template/slot rows into performed slots (shared by startSession / startWorkout)
function slotsToPerformed(slotsInput: ExerciseSlot[]): PerformedSlot[] {
  return slotsInput.map((slot, orderIndex) => ({
    ...slot,
    orderIndex,
    sets: slot.sets.map(s => ({
      ...s,
      skipped: false,
      actualWeight: s.weight,
      actualReps: s.reps,
      actualDurationSeconds: s.durationSeconds
    }))
  }))
}

// ---------------------------------------------------------------------------
// Active session store — manages the in-progress workout state
// ---------------------------------------------------------------------------
interface ActiveSessionStore {
  session: WorkoutSession | null
  currentSlotIndex: number
  currentSetIndex: number
  restSecondsRemaining: number
  restTimerActive: boolean
  newPRExerciseIds: string[]

  startSession: (template: WorkoutTemplate) => void
  startWorkout: (workoutId: string, name: string, slots: ExerciseSlot[]) => void
  startAdHocSession: (name: string) => void
  completeSet: (slotIdx: number, setIdx: number, updates: Partial<PerformedSet>) => void
  skipSet: (slotIdx: number, setIdx: number) => void
  skipSlot: (slotIdx: number) => void
  selectVariation: (slotIdx: number, variation: string | undefined) => void
  goToSlot: (slotIdx: number) => void
  reorderSlots: (from: number, to: number) => void
  setSlotRating: (slotIdx: number, rating: DifficultyRating) => void
  advanceCursor: () => void
  startRestTimer: (seconds: number) => void
  adjustRestTimer: (delta: number) => void
  tickRestTimer: () => void
  stopRestTimer: () => void
  endSession: () => Promise<string | null>
  clearSession: () => void
}

export const useActiveSessionStore = create<ActiveSessionStore>((set, get) => ({
  session: null,
  currentSlotIndex: 0,
  currentSetIndex: 0,
  restSecondsRemaining: 0,
  restTimerActive: false,
  newPRExerciseIds: [],

  // Start a session from a template — deep-copy all slots and sets
  startSession: (template) => {
    const now = Date.now()
    const slots = slotsToPerformed(template.slots)
    const session: WorkoutSession = {
      id: nanoid(),
      templateId: template.id,
      name: template.name,
      startedAt: now,
      slots,
      totalVolumeKg: 0
    }
    set({ session, currentSlotIndex: 0, currentSetIndex: 0, newPRExerciseIds: [] })
  },

  // Start from a saved Workout after setup — merged slots, no templateId
  startWorkout: (workoutId, name, slotsInput) => {
    const slots = slotsToPerformed(slotsInput)
    const session: WorkoutSession = {
      id: nanoid(),
      workoutId,
      name,
      startedAt: Date.now(),
      slots,
      totalVolumeKg: 0
    }
    set({ session, currentSlotIndex: 0, currentSetIndex: 0, newPRExerciseIds: [] })
  },

  // Start a blank ad-hoc session with no pre-loaded exercises
  startAdHocSession: (name) => {
    const session: WorkoutSession = {
      id: nanoid(),
      name,
      startedAt: Date.now(),
      slots: [],
      totalVolumeKg: 0
    }
    set({ session, currentSlotIndex: 0, currentSetIndex: 0, newPRExerciseIds: [] })
  },

  // Mark a set as completed with actual values
  completeSet: (slotIdx, setIdx, updates) => {
    const { session } = get()
    if (!session) return
    const slots = session.slots.map((slot, si) => {
      if (si !== slotIdx) return slot
      return {
        ...slot,
        sets: slot.sets.map((s, i) =>
          i !== setIdx ? s : { ...s, ...updates, completedAt: Date.now(), skipped: false }
        )
      }
    })
    set({ session: { ...session, slots } })
  },

  skipSet: (slotIdx, setIdx) => {
    const { session } = get()
    if (!session) return
    const slots = session.slots.map((slot, si) => {
      if (si !== slotIdx) return slot
      return {
        ...slot,
        sets: slot.sets.map((s, i) =>
          i !== setIdx ? s : { ...s, skipped: true, completedAt: Date.now() }
        )
      }
    })
    set({ session: { ...session, slots } })
  },

  // Skip every remaining set in a slot (whole exercise)
  skipSlot: (slotIdx) => {
    const { session } = get()
    if (!session) return
    const now = Date.now()
    const slots = session.slots.map((slot, si) => {
      if (si !== slotIdx) return slot
      return {
        ...slot,
        sets: slot.sets.map(s => (s.completedAt ? s : { ...s, skipped: true, completedAt: now }))
      }
    })
    set({ session: { ...session, slots } })
    get().advanceCursor()
  },

  selectVariation: (slotIdx, variation) => {
    const { session } = get()
    if (!session) return
    const slots = session.slots.map((slot, si) =>
      si !== slotIdx ? slot : { ...slot, selectedVariation: variation }
    )
    set({ session: { ...session, slots } })
  },

  goToSlot: (slotIdx) => {
    const { session } = get()
    if (!session || slotIdx < 0 || slotIdx >= session.slots.length) return
    const slot = session.slots[slotIdx]
    const firstIncomplete = slot.sets.findIndex(s => !s.completedAt)
    if (firstIncomplete !== -1) set({ currentSlotIndex: slotIdx, currentSetIndex: firstIncomplete })
    else set({ currentSlotIndex: slotIdx, currentSetIndex: Math.max(0, slot.sets.length - 1) })
  },

  reorderSlots: (from, to) => {
    const { session, currentSlotIndex } = get()
    if (!session || from < 0 || to < 0 || from >= session.slots.length || to >= session.slots.length || from === to) return
    const currentId = session.slots[currentSlotIndex]?.id
    const slots = [...session.slots]
    const [moved] = slots.splice(from, 1)
    slots.splice(to, 0, moved)
    const newIdx = currentId ? slots.findIndex(s => s.id === currentId) : 0
    set({
      session: { ...session, slots: slots.map((s, i) => ({ ...s, orderIndex: i })) },
      currentSlotIndex: newIdx >= 0 ? newIdx : 0
    })
  },

  setSlotRating: (slotIdx, rating) => {
    const { session } = get()
    if (!session) return
    const slots = session.slots.map((slot, si) =>
      si !== slotIdx ? slot : { ...slot, difficultyRating: rating }
    )
    set({ session: { ...session, slots } })
  },

  // Move cursor to the next incomplete set
  advanceCursor: () => {
    const { session, currentSlotIndex, currentSetIndex } = get()
    if (!session) return
    const slot = session.slots[currentSlotIndex]
    if (!slot) return

    // Try next set in same slot
    const nextSet = slot.sets.findIndex((s, i) => i > currentSetIndex && !s.completedAt)
    if (nextSet !== -1) { set({ currentSetIndex: nextSet }); return }

    // Move to next slot with incomplete sets
    for (let si = currentSlotIndex + 1; si < session.slots.length; si++) {
      const nextSlot = session.slots[si]
      const firstSet = nextSlot.sets.findIndex(s => !s.completedAt)
      if (firstSet !== -1) { set({ currentSlotIndex: si, currentSetIndex: firstSet }); return }
    }
  },

  startRestTimer: (seconds) => set({ restSecondsRemaining: seconds, restTimerActive: true }),
  adjustRestTimer: (delta) => set(state => ({
    restSecondsRemaining: Math.max(0, state.restSecondsRemaining + delta)
  })),
  tickRestTimer: () => {
    const { restSecondsRemaining } = get()
    if (restSecondsRemaining <= 1) {
      set({ restSecondsRemaining: 0, restTimerActive: false })
      get().advanceCursor()
    } else {
      set({ restSecondsRemaining: restSecondsRemaining - 1 })
    }
  },
  stopRestTimer: () => set({ restTimerActive: false, restSecondsRemaining: 0 }),

  // Finalise and persist the session, detect PRs
  endSession: async () => {
    const { session } = get()
    if (!session) return null
    const completedAt = Date.now()
    const totalVolumeKg = calcSessionVolume(session)
    const finalSession: WorkoutSession = { ...session, completedAt, totalVolumeKg }
    await db.sessions.put(finalSession)
    const prs = await detectAndSavePRs(finalSession)
    set({
      session: finalSession,
      newPRExerciseIds: prs.map(p => p.exerciseId)
    })
    return finalSession.id
  },

  clearSession: () => set({
    session: null,
    currentSlotIndex: 0,
    currentSetIndex: 0,
    restSecondsRemaining: 0,
    restTimerActive: false,
    newPRExerciseIds: []
  })
}))
