# NotHevy — Workout App: Technical & Conceptual Plan

## Concept

A PWA workout tracker with a focus on **in-session usability** — fast to log, smart about what to do next, and capable of growing with the user over time. No server, no auth, everything lives locally.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React + TypeScript + Vite | Fast DX, great ecosystem |
| Local DB | **Dexie.js** (IndexedDB wrapper) | Typed, async, reactive queries |
| State | **Zustand** | Minimal, works well alongside Dexie |
| Styling | **Tailwind CSS** | Mobile-first utility classes |
| PWA | **vite-plugin-pwa** | Service worker + manifest out of the box |
| AI | **Claude API** | Workout generation, coaching, insights |

---

## Data Model

The objects are designed to be composable and avoid duplication.

### `Exercise`
The atomic unit. User-defined only.

```ts
type SetType = "reps" | "timed" | "failure"  // failure = reps to failure

interface Exercise {
  id: string
  name: string
  muscleGroups: MuscleGroup[]          // primary + secondary
  equipment: Equipment[]
  defaultSetType: SetType
  defaultRestSeconds: number
  instructions?: string
  tags: string[]
  createdAt: number
}
```

### `ExerciseSlot`
An exercise as it appears inside a template or session. Holds target values.

```ts
interface ExerciseSlot {
  id: string
  exerciseId: string
  supersetGroupId?: string             // same ID = grouped in superset
  orderIndex: number                   // position in workout
  sets: SetTarget[]
  notes?: string
}

interface SetTarget {
  id: string
  type: SetType
  reps?: number                        // for "reps" / "failure"
  durationSeconds?: number             // for "timed"
  weight?: number
  weightUnit: "kg" | "lbs"
  restSeconds: number                  // per-set rest override
}
```

### `WorkoutTemplate`
A reusable plan. The source of truth before a session begins.

```ts
interface WorkoutTemplate {
  id: string
  name: string
  description?: string
  tags: string[]                       // e.g. "push", "legs", "upper body"
  slots: ExerciseSlot[]
  estimatedMinutes?: number
  createdAt: number
  updatedAt: number
}
```

### `WorkoutSession`
A snapshot of a template that was actually performed. Values are filled in as sets are completed.

```ts
interface WorkoutSession {
  id: string
  templateId?: string                  // null if ad-hoc
  name: string
  startedAt: number
  completedAt?: number
  slots: PerformedSlot[]              // deep copy of ExerciseSlots + actual values
  notes?: string
  totalVolumeKg: number               // computed on save
}

interface PerformedSet extends SetTarget {
  actualReps?: number
  actualDurationSeconds?: number
  actualWeight?: number
  actualRestSeconds?: number
  skipped: boolean
  completedAt?: number
}

interface PerformedSlot extends ExerciseSlot {
  sets: PerformedSet[]
}
```

### `PersonalRecord`

```ts
interface PersonalRecord {
  id: string
  exerciseId: string
  type: "1rm" | "max_reps_at_weight" | "max_volume_session"
  value: number
  achievedAt: number
  sessionId: string
}
```

### `AppSettings`

```ts
interface AppSettings {
  defaultWeightUnit: "kg" | "lbs"
  defaultRestSeconds: number
  theme: "dark" | "light" | "system"
  claudeApiKey?: string
}
```

---

## Database Schema (Dexie)

```ts
db.version(1).stores({
  exercises:        "id, name, *muscleGroups, *tags",
  templates:        "id, name, *tags, updatedAt",
  sessions:         "id, templateId, startedAt, completedAt",
  personalRecords:  "id, exerciseId, type, achievedAt",
  settings:         "key"
})
```

---

## Smart Features

### Progressive Overload
On session start (or when a set is completed), look up the last session containing the same `exerciseId`. Compare completed sets → suggest `+2.5kg` or `+1 rep`. Shown as a subtle chip: *"Last time: 80kg × 8 — try 82.5kg?"*

### Rest Timer & Auto-Advance
Each set completion starts a countdown (`restSeconds`). On expiry: auto-highlight next set. During supersets, the rest fires only after the **last exercise in the group** completes its set, then cycles back to the first.

### Superset Flow
Slots with the same `supersetGroupId` are rendered as a group and executed in round-robin: A set 1 → B set 1 → rest → A set 2 → B set 2 → rest → ...

### Timed Sets
`SetTarget.type = "timed"` shows a countdown timer instead of a rep input. On expiry, set is auto-marked complete.

### Volume & PR Tracking
- After session save: compute `sum(weight × reps)` per muscle group → stored on session
- After each set: check against `PersonalRecord` table → surface PR badge in-session
- History view: chart volume per muscle group over time (using a lightweight chart lib like `recharts`)

### AI (Claude API)
Three use cases:
1. **Generate template** — user describes goal in plain text, Claude returns a `WorkoutTemplate` JSON
2. **In-session coach** — Claude reads current session state, gives real-time advice
3. **Weekly insight** — Claude summarizes the last N sessions, flags imbalances or plateaus

Claude calls happen client-side using the user's own API key stored in `AppSettings`.

---

## App Structure (Pages)

```
/                   → Dashboard (recent sessions, quick-start)
/exercises          → Exercise library (CRUD)
/templates          → Template list
/templates/new      → Template builder
/templates/:id      → Edit template
/session/active     → Active workout (primary UI)
/session/:id        → Session recap / history detail
/history            → All sessions, volume charts
/settings           → Units, rest defaults, API key
```

---

## Active Session UI Flow

```
[Start from template]
        ↓
[Session screen: current exercise + set highlighted]
        ↓
[Log set: weight + reps/time input → Complete]
        ↓
[Rest timer starts] ←── superset? cycle to next in group first
        ↓
[Auto-advance to next set or exercise]
        ↓
[All sets done → End Workout]
        ↓
[Session recap: PRs hit, volume, duration, notes]
```

---

## Extensibility Notes

- **Cardio / distance sets:** Add `SetType = "distance"` with `distanceMeters` — the slot/session model absorbs it cleanly
- **Multi-user:** Dexie can be swapped for a remote-synced backend (e.g. PocketBase, Supabase) without changing the data model
- **Wearables / health APIs:** Hook into Web Bluetooth or Apple HealthKit via Capacitor later if needed
- **Offline AI:** Local LLM via WebLLM could replace Claude for fully offline use

---

## Implementation Order

1. Scaffold Vite + React + TS + Tailwind + PWA plugin
2. Define and initialize Dexie schema
3. Exercise CRUD
4. Template builder
5. Active session screen (the core loop)
6. Rest timer + superset logic
7. History + PR detection
8. AI integration
9. Progressive overload suggestions
