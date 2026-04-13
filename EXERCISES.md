# Exercise Builder — Agent Guide

How to construct valid exercise entries for `public/local-db.json`.

---

## Exercise Schema

```ts
interface Exercise {
  id: string                  // nanoid — generate with: crypto.randomUUID() or nanoid(21)
  ownerUserId?: string        // always "local-default" for seeded data
  name: string                // human-readable, title-case
  muscleGroups: string[]      // see allowed values below
  equipment: string[]         // see allowed values below
  defaultSetType: SetType     // "reps" | "timed" | "failure"
  defaultRestSeconds: number  // typically 60–180
  defaultSets: SetTarget[]    // 2–5 sets recommended
  media: []                   // always [] when seeding
  instructions?: string       // coaching cues, optional
  tags: string[]              // always [] unless you have specific tags
  variations?: string[]       // e.g. ["Wide Grip", "Close Grip"]
  createdAt: number           // Unix ms timestamp — Date.now()
}
```

## SetTarget Schema

```ts
interface SetTarget {
  id: string          // nanoid — unique per set
  type: SetType       // must match exercise defaultSetType
  reps?: number       // required when type = "reps" or "failure"
  durationSeconds?: number  // required when type = "timed"
  weight?: number     // omit if bodyweight or no default weight
  weightUnit: "kg" | "lbs"
  restSeconds: number // should match exercise defaultRestSeconds
}
```

---

## Allowed Values

### muscleGroups
```
chest | back | shoulders | biceps | triceps | forearms
quads | hamstrings | glutes | calves | core | traps | lats | full_body | legs
```
An exercise can target multiple groups: `["chest", "triceps"]`

### equipment
```
barbell | dumbbell | kettlebell | cable | machine | bodyweight
resistance_band | smith_machine | pull_up_bar | rings | other
```
Leave as `[]` for pure bodyweight exercises with no attachment.

### SetType behaviour
| type | reps | durationSeconds | weight |
|---|---|---|---|
| `"reps"` | required | — | optional |
| `"timed"` | — | required | optional |
| `"failure"` | set to target reps, actual logged at runtime | — | optional |

---

## Minimal Example — Bodyweight

```json
{
  "id": "REPLACE_WITH_NANOID",
  "ownerUserId": "local-default",
  "name": "Push-up",
  "muscleGroups": ["chest", "triceps"],
  "equipment": [],
  "defaultSetType": "reps",
  "defaultRestSeconds": 60,
  "defaultSets": [
    { "id": "REPLACE_WITH_NANOID", "type": "reps", "reps": 12, "weightUnit": "kg", "restSeconds": 60 },
    { "id": "REPLACE_WITH_NANOID", "type": "reps", "reps": 12, "weightUnit": "kg", "restSeconds": 60 },
    { "id": "REPLACE_WITH_NANOID", "type": "reps", "reps": 12, "weightUnit": "kg", "restSeconds": 60 }
  ],
  "media": [],
  "instructions": "Keep core tight, full range of motion.",
  "tags": [],
  "variations": ["Wide Grip", "Diamond", "Incline"],
  "createdAt": 1775421572525
}
```

## Minimal Example — Weighted

```json
{
  "id": "REPLACE_WITH_NANOID",
  "ownerUserId": "local-default",
  "name": "Barbell Back Squat",
  "muscleGroups": ["quads", "glutes", "hamstrings"],
  "equipment": ["barbell"],
  "defaultSetType": "reps",
  "defaultRestSeconds": 180,
  "defaultSets": [
    { "id": "REPLACE_WITH_NANOID", "type": "reps", "reps": 5, "weight": 80, "weightUnit": "kg", "restSeconds": 180 },
    { "id": "REPLACE_WITH_NANOID", "type": "reps", "reps": 5, "weight": 80, "weightUnit": "kg", "restSeconds": 180 },
    { "id": "REPLACE_WITH_NANOID", "type": "reps", "reps": 5, "weight": 80, "weightUnit": "kg", "restSeconds": 180 }
  ],
  "media": [],
  "instructions": "Bar on traps, brace core, drive knees out.",
  "tags": [],
  "variations": ["Front Squat", "Pause Squat", "Box Squat"],
  "createdAt": 1775421572525
}
```

## Minimal Example — Timed

```json
{
  "id": "REPLACE_WITH_NANOID",
  "ownerUserId": "local-default",
  "name": "Plank",
  "muscleGroups": ["core"],
  "equipment": [],
  "defaultSetType": "timed",
  "defaultRestSeconds": 60,
  "defaultSets": [
    { "id": "REPLACE_WITH_NANOID", "type": "timed", "durationSeconds": 60, "weightUnit": "kg", "restSeconds": 60 },
    { "id": "REPLACE_WITH_NANOID", "type": "timed", "durationSeconds": 60, "weightUnit": "kg", "restSeconds": 60 },
    { "id": "REPLACE_WITH_NANOID", "type": "timed", "durationSeconds": 60, "weightUnit": "kg", "restSeconds": 60 }
  ],
  "media": [],
  "instructions": "",
  "tags": [],
  "variations": [],
  "createdAt": 1775421572525
}
```

---

## Rules for Agents

1. **IDs must be unique** — generate a fresh nanoid/uuid for every `exercise.id` and every `set.id`. Never reuse.
2. **`createdAt`** — use a real Unix ms timestamp. Exercises seeded together can share the same timestamp.
3. **`defaultSetType` must match all set `type` fields** in `defaultSets`.
4. **`restSeconds` on each set** should match `defaultRestSeconds` unless intentionally different.
5. **`weight` is optional** — omit it entirely for bodyweight-only exercises. Do not set it to `0`.
6. **`ownerUserId`** — always `"local-default"` for seeded/local data. Omit for exercises without an owner.
7. Append new exercises to the `exercises` array in `public/local-db.json`. Do not remove existing entries.
8. After editing `local-db.json`, the app will reload the DB on next start — no migration needed.
