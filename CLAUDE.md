# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step required. Serve the project root with any HTTP server:

```bash
npx serve . -p 8080
```

App runs at `http://localhost:8080`. The `.vscode/launch.json` is configured for Chrome debugging at that port.

## Architecture

This is a **zero-dependency vanilla JS PWA** — no package.json, no build system, no frameworks. All logic lives in three files at the project root:

- `index.html` — markup, loads Supabase SDK via CDN
- `script.js` — all application logic (~394 lines)
- `styles.css` — all styles (~419 lines)

### Backend: Supabase

Supabase credentials are hardcoded at the top of `script.js`. The app uses two tables:

- **`users`** — `email`, `is_approved` (boolean): admin must manually set `is_approved = true` to grant access
- **`deeds`** — `id`, `user_email`, `portion` (MBH or ZBH), `deed_type` (Good Deed or Bad Deed), `created_at`

### Auth Flow

1. Check for existing session on load
2. If none, show login overlay with Google OAuth
3. After login, check `users` table for `is_approved`
4. Approved users see the app; others see a pending message

### Data Flow

Deed counts are cached in `localStorage` (keys: `count-{portion}-{type}`) for instant UI updates. `updateCounts()` fetches fresh counts from Supabase and refreshes the cache.

### UI

Dark glassmorphism theme. Two hardcoded "portions": **MBH** and **ZBH** (the two people tracking deeds).
