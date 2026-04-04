# NotHevy

Fast, offline-first PWA workout tracker. No account, no server — everything lives in your browser.

## Features

- **Exercise library** — create reusable exercises with muscle groups, equipment and set defaults
- **Template builder** — build workout plans manually or generate them with Claude AI
- **Active session** — log sets in real-time with a guided flow, rest timer, and superset support
- **Progressive overload** — automatic suggestions based on your last session for each exercise
- **PR detection** — 1RM estimated (Epley formula) and tracked after every session
- **History + charts** — volume-over-time area chart, session recaps, PR log
- **Claude integration** — template generation, in-session coaching, and weekly insight (requires your own API key)
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

Go to **Settings → Claude API Key** and enter your `sk-ant-api03-…` key. It is stored only in IndexedDB on your device and is never sent to any server other than Anthropic's API.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Local DB | Dexie.js (IndexedDB) |
| State | Zustand |
| Styling | Tailwind CSS |
| PWA | vite-plugin-pwa |
| AI | Claude API (client-side) |
| Charts | Recharts |

## Version History

| Version | Notes |
|---|---|
| 0.2.6 | Git repository setup; root `.gitignore` and `.gitattributes` for Vite/Node |
| 0.1.0 | Initial implementation — full core loop, AI, PWA |
