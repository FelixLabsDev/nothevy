# NotHevy

Fast, offline-first PWA workout tracker.

**Repository:** [github.com/FelixLabsDev/nothevy](https://github.com/FelixLabsDev/nothevy) No account, no server — everything lives in your browser.

## Features

- **Exercise library** — create reusable exercises with muscle groups, equipment and set defaults
- **Template builder** — build workout plans manually or generate them with Claude AI
- **Active session** — log sets in real-time with a guided flow, rest timer, and superset support
- **Progressive overload** — automatic suggestions based on your last session for each exercise
- **PR detection** — 1RM estimated (Epley formula) and tracked after every session
- **History + charts** — volume-over-time area chart, session recaps, PR log
- **Multi-provider AI** — template generation, in-session coaching, and weekly insight via Claude, OpenAI, or OpenRouter (requires your own API key)
- **PWA** — installable, works fully offline after first load

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node ≥ 18 + npm)

### Install & Run

```bash
bun install
bun run dev
```

Open `http://localhost:5173`.

### Build for Production

```bash
bun run build
bun run preview
```

### AI Features

Go to **Settings → AI Provider** and set provider, model, and API key. Keys are stored only in IndexedDB on your device and are sent only to the selected provider.

### Local DB File (Committed)

- A committed seed file lives at `public/local-db.json`
- On first run (when Dexie is empty), the app imports this file automatically
- Runtime data still persists in browser IndexedDB (`NotHevyDB`)
- To update the committed seed, edit `public/local-db.json` and commit that file

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Local DB | Dexie.js (IndexedDB) |
| State | Zustand |
| Styling | Tailwind CSS |
| PWA | vite-plugin-pwa |
| AI | LangChain (Claude / OpenAI / OpenRouter) |
| Charts | Recharts |

## Version History

| Version | Notes |
|---|---|
| 0.4.0 | Add Export DB Seed button to Settings; remove dead claude.ts |
| 0.3.0 | Add account-ready DB schema (`users`, linked accounts, user settings, ownerUserId indexes) with migration |
| 0.2.12 | Add committed local DB seed file (`public/local-db.json`) and first-run bootstrap import |
| 0.2.11 | Add media (images/videos) section to exercise editor with upload and URL fetch |
| 0.2.10 | Refactor exercise set editor to per-set cards with rest stepper and no-rest option |
| 0.2.9 | Add multi-provider AI via LangChain (Claude, OpenAI, OpenRouter) with custom model selection |
| 0.2.8 | Add pull-up bar and rings to equipment list; fix underscore display in labels |
| 0.2.7 | Document GitHub remote URL in README |
| 0.2.6 | Git repository setup; root `.gitignore` and `.gitattributes` for Vite/Node |
| 0.1.0 | Initial implementation — full core loop, AI, PWA |
