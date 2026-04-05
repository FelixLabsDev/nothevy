# NotHevy — Architecture

## Overview

Single-page React app (Vite). All data is local — no backend, no auth. IndexedDB (via Dexie) is the only persistence layer.

```
src/
├── types/         Pure TypeScript interfaces (Exercise, Template, Session, …)
├── db/            Dexie schema, settings helpers, local-file seed bootstrap
├── lib/
│   ├── workout.ts Volume calc, PR detection, progressive overload, ID generation
│   └── ai.ts      LangChain AI calls (template gen, coaching, weekly insight)
├── stores/
│   ├── settingsStore.ts  Zustand — app settings, persisted in Dexie
│   └── sessionStore.ts   Zustand — in-progress workout state + rest timer
├── components/    Shared UI (BottomNav, PageHeader)
├── pages/         One file per route
│   ├── Dashboard.tsx
│   ├── Exercises.tsx
│   ├── Templates.tsx
│   ├── TemplateEditor.tsx
│   ├── ActiveSession.tsx
│   ├── SessionRecap.tsx
│   ├── History.tsx
│   └── Settings.tsx
├── App.tsx        Router + settings bootstrap
├── main.tsx       ReactDOM entry
└── index.css      Tailwind + reusable component classes
```

## Data Flow

```
IndexedDB (Dexie)
      ↕  useLiveQuery (reactive)
React Components ←→ Zustand stores
                        ↕
                   Dexie mutations
```

- **Read**: components subscribe via `useLiveQuery` — re-renders on any relevant DB change.
- **Write**: mutations go through Dexie directly (exercises, templates, sessions) or through Zustand (in-session state).
- **Settings**: stored as `{key, value}` rows in Dexie; `settingsStore` caches them in Zustand.
- **Seed file**: if Dexie is empty on first run, app loads `public/local-db.json` into tables.

## Data Model

```
Exercise          ─── referenced by ──▶  ExerciseSlot
WorkoutTemplate   ─── contains ────────▶  ExerciseSlot[]
WorkoutSession    ─── deep-copy of ─────▶  PerformedSlot[] (with actual values)
PersonalRecord    ─── links to ─────────▶  Exercise + WorkoutSession
AppUser           ─── owns ─────────────▶  Exercise/Template/Session/PersonalRecord (ownerUserId)
LinkedAuthAccount ─── maps provider IDs ▶  AppUser
UserSettingRow    ─── per-user settings ▶  AppUser
```

`PerformedSet extends SetTarget` — target values carried in, actual values written during session.

### Account-Ready Schema (Future-Proofing)

- `Dexie` schema `version(2)` adds `users`, `linkedAuthAccounts`, and `userSettings` tables.
- Workout-domain tables now include optional `ownerUserId` indexes to support multi-account partitioning.
- Migration backfills legacy rows with `ownerUserId = "local-default"` and ensures a default local user exists.
- Current app behavior remains single-user local; these fields/tables are preparation for future auth/sync work.

## Active Session State Machine

```
startSession(template) → copies slots/sets into Zustand
     ↓
completeSet(slotIdx, setIdx, actuals)
     ↓
startRestTimer(seconds) → tickRestTimer() × N → advanceCursor()
     ↓
endSession() → calcSessionVolume() → db.sessions.put() → detectAndSavePRs()
     ↓
navigate("/session/:id")
```

Superset support: slots with matching `supersetGroupId` are meant to be executed round-robin. The cursor advances to the next slot in the group before starting rest.

## AI (LangChain)

All calls happen **client-side** via `src/lib/ai.ts` using LangChain (`@langchain/anthropic`, `@langchain/openai`) with `dangerouslyAllowBrowser: true`. The user selects a provider (Claude / OpenAI / OpenRouter), optionally a custom model, and enters their API key in Settings. Keys are stored in Dexie settings only.

| Feature | Default model | Token budget |
|---|---|---|
| Template generation | Provider capable-tier default | 2 048 |
| In-session coaching | Provider fast-tier default | 512 |
| Weekly insight | Provider fast-tier default | 1 024 |

## PWA

`vite-plugin-pwa` generates a Workbox service worker that precaches all build assets. The app loads and works fully offline after first visit. The manifest enables "Add to Home Screen" on iOS and Android.

## Extensibility

- **Cardio / distance sets**: add `SetType = "distance"` with `distanceMeters` — the slot/session shape absorbs it with no breaking changes.
- **Remote sync**: swap Dexie for a Dexie-Cloud or PocketBase adapter; the store interfaces stay the same.
- **Wearables**: hook Web Bluetooth or HealthKit (via Capacitor) into the active session screen.
- **Offline AI**: replace Claude calls with a local WebLLM model.
