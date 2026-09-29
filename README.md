# Flowstate (PWA + Tauri Desktop)

Local-first app to log freshwater aquarium chemistry and visualize trends with minimalist charts.

- Browser/PWA: IndexedDB + Service Worker; no accounts or cloud.
- Desktop (Tauri): Real SQLite database file stored in the OS app data directory.

## Quick Start (Web)

- Prereqs: Bun 1.x
- Install: `bun install`
- Dev: `bun run dev` then open http://127.0.0.1:4040
- Lint: `bun run lint`
- Format: `bun run format`
- Format check: `bun run format:check`
- Tests: `bun run test`
- Build: `bun run build`
- Start: `bun run start`

## PWA & Offline

- Manifest: `public/manifest.webmanifest`
- Service Worker: `public/service-worker.js`
  - Pages are network-first and cached per URL (offline falls back to the cached page, then `/`).
  - `/_next/static/*` is cache-first (content-hashed); other same-origin GETs are network-first.
  - Updates activate in the background; there is no forced reload, so a half-entered reading is never lost.
- Install the app from the browser’s “Install” or “Add to Home Screen”.

## Key Features

- Quick Entry for pH, Ammonia (NH3/NH4+), Nitrite (NO2−), Nitrate (NO3−), with inline validation.
  **Partial readings:** leave a field blank for "not tested" (saved as `null`, shown as "—",
  skipped by charts and counts). At least one result is required; a typed value must be in
  range. Blanks are never saved as 0.
- **Kit-value chips** under each input: tap a colour-card value from the API Freshwater Master
  Test Kit (pH has a "High-range kit" toggle); tap the selected chip again to clear it. Free
  typing still works. Values live in `lib/kit.ts`.
- **Status card** on the dashboard: nitrogen-cycle status, days since the last test, and the latest
  value per metric with a trend arrow and out-of-range emphasis (`lib/status.ts`).
- Minimal small-multiples charts on a shared time axis with optimal/caution bands, out-of-range
  markers (shape + color), and a tap/hover/keyboard readout of value, time, and note
- Per‑tank reminder cadence with in‑app notices, Snooze 24h / Skip, and optional system
  notifications (shown when a test comes due while the app is open)
- Edit (including date/time) and delete readings, backdating, duplicate guard within 1 hour
- CSV export (report range or all readings), printable 30/90‑day report with charts, JSON backup/restore

## Project Structure (selected)

- `app/` Next.js App Router
  - `page.tsx` — log page: tank switcher, Quick Entry, recent readings, reminders
  - `tanks/page.tsx` — charts + full reading list (optional `tankId` query selects the tank)
  - `tanks/report/page.tsx` — printable report with charts and CSV export (optional `tankId` query)
  - `settings/page.tsx` — storage info and JSON backup/restore
- `components/`
  - `TankProvider.tsx` (loads tanks, seeds the first tank, tracks the active one), `NavBar.tsx`
  - `TankSwitcher.tsx`, `TankFromQuery.tsx`, `QuickEntry.tsx`, `ReadingList.tsx`
  - `ReminderControls.tsx`, `NotificationsToggle.tsx`
  - `charts/MetricChart.tsx`, `charts/SmallMultiples.tsx`, `charts/TankSeries.tsx`
- `lib/`
  - `models.ts` — types, constants (kit steps, optimal ranges)
  - `idb.ts` — unified storage entrypoint; routes to SQLite when running under Tauri, otherwise
    IndexedDB. Normalizes timestamps to UTC and validates backups before import.
  - `idb-browser.ts` — browser-only IndexedDB helpers
  - `sqlite.ts` — Tauri SQLite adapter
  - `validation.ts` — parsing/validation of metric inputs
  - `series.ts` — rolling averages, y-domains, out-of-range/severity helpers
  - `backup.ts` — JSON backup validation
  - `time.ts`, `format.ts`, `notify.ts`
  - `reminders.ts` — in‑app scheduling (due, snooze, skip)
  - `export.ts` — CSV generation
- `public/manifest.webmanifest`, `public/service-worker.js`, `public/icons/*`
- `styles/print.css`, `app/globals.css`

## Data Schema (v1)

- Tank: `{ id, name, createdAt, archivedAt?, reminderCadence }`
- Reading: `{ id, tankId, ts, pH, ammonia, nitrite, nitrate, note? }` (each metric is `number | null`; `null` = not tested, at least one is non-null)
- Settings (global): `{ units?, theme?, chartOptions? }`

Conventions

- Timestamps: stored as UTC ISO 8601 (`…Z`) so string-ordered indexes stay chronological;
  displayed in local time.
- Kit steps (input steppers): pH 0.1; Ammonia 0.25 ppm; Nitrite 0.1 ppm; Nitrate 1.0 ppm. Typed
  values are kept (pH/ammonia/nitrite to 0.01, nitrate to 0.1) so kit colors like nitrite 0.25
  survive. Accepted ranges: pH 5–9, ammonia/nitrite 0–10, nitrate 0–200 ppm.
- Optimal bands: pH 6.5–7.5; Ammonia 0; Nitrite 0; Nitrate 0–20 ppm, 20–40 caution, > 40 high.
- Nitrogen-cycle status (`cycleStatus` in `lib/status.ts`), from the whole history, skipping untested
  metrics: **cycling** = latest ammonia or latest nitrite is above 0; **not started** = otherwise,
  ammonia or nitrite has never been tested; **cycled** = the latest 3 readings that tested both
  ammonia and nitrite were all 0/0 and nitrate above 0 has been seen; **nearly cycled** = both
  tested and 0 now but the cycled test is not met yet.

## CSV Export

- Headers: `tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note`
- Source: `lib/export.ts` and UI in `components/ReportClient.tsx`

## Testing

- Unit tests: `tests/lib/*.test.ts`
- Component tests: `tests/components/*.test.tsx`
- Run: `bun run test`

## Continuous Integration

There is no CI. Before you push, run `bun install --frozen-lockfile`,
`bun run lint`, `bun run format:check`, and `bun run test`.

Buildkite ran CI from 2026-08-27 until it was removed on 2026-09-22. The
pipeline file is in git history before that date.

## Accessibility & Theming

- Color‑blind‑friendly defaults, minimal charts, keyboardable inputs.
- Print CSS included for reports.

## Known Limitations & Next Steps

- Custom optimal ranges per tank not exposed in the UI yet (planned v1.1).
- Charts are basic SVG for v1; zoom/pan is out of scope.
- System notifications only fire while the app is open (there's no push server by design), and
  depend on browser support and permission. The in-app reminder always works.

## Desktop (Tauri)

- Prereqs: Rust toolchain (`@tauri-apps/cli` is already a devDependency, installed via `bun install`)
- Dev: `bun run tauri:dev` (spawns Next dev and Tauri window)
- Build: `bun run tauri:build` (embeds `next export` output)

Storage on desktop

- SQLite file is created under the app’s local data directory (platform-specific path) with filename `flowstate.db`.
- The web code detects Tauri at runtime and routes all storage calls to SQLite via Rust `invoke('sqlite_*', ...)` commands (implemented with `rusqlite` in `src-tauri/src/db.rs`, wired up as Tauri commands in `src-tauri/src/main.rs`).

Schema migration

- The desktop database tracks its schema in `PRAGMA user_version`. On launch, a database from
  before partial readings (version 0) is rebuilt in one transaction so the metric columns accept
  `NULL`; every existing row is kept unchanged. New databases start at the current version. DB code
  lives in `src-tauri/src/db.rs` (with unit tests: `cargo test` in `src-tauri`).

Migration from PWA

- Automatic migration from browser IndexedDB to the desktop app is not possible across origins. Use CSV export (and a forthcoming JSON import) to carry data over.

### Icons

- Icon sources live in `src-tauri/icons/`. The current set shipped in commit a1bab51.
- Replace `src-tauri/icons/icon.png` with a 1024×1024 PNG to rebrand the app, then regenerate:
  - `bunx tauri icon src-tauri/icons/icon.png`
- The Tauri config points to `icon.png`, `icon.icns`, and `icon.ico` and will package them for macOS/Windows/Linux.

## Development Guidelines

- Follow `AGENTS.md` for goals, standards, and Definition of Done.
- Keep components small; move logic into `lib/` with tests.
- Use `tasks/prd-aquarium-water-tracker.md` for scope; the task checklist in `tasks/` is historical.

## License

MIT © 2025 Trey Causey. See `LICENSE` for details.
