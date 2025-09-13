# Flowstate (PWA)

Local-first web app to log freshwater aquarium chemistry and visualize trends with minimalist charts. Works offline via IndexedDB + Service Worker; no accounts or cloud.

## Quick Start
- Prereqs: Node 18+ and npm
- Install: `npm install`
- Dev: `npm run dev` then open http://localhost:3000
- Lint: `npm run lint`
- Tests: `npm test`
- Build: `npm run build`
- Start: `npm start`

## PWA & Offline
- Manifest: `public/manifest.webmanifest`
- Service Worker: `public/service-worker.js`
  - Caches app shell; network-first for navigations with offline fallback to `/`.
  - Update flow prompts the user to reload when a new version is ready.
- Install the app from the browser’s “Install” or “Add to Home Screen”.

## Key Features
- Quick Entry for pH, Ammonia (NH3/NH4+), Nitrite (NO2−), Nitrate (NO3−)
- Minimal small-multiples charts with optimal bands and anomaly dots
- Per‑tank reminder cadence with in‑app notices; optional notifications
- Edit/delete readings, backdating, duplicate guard within 1 hour
- CSV export and a printable report page

## Project Structure (selected)
- `app/` Next.js App Router
  - `page.tsx` — dashboard with Tank switcher, Quick Entry, reminders, recent readings
  - `tanks/[tankId]/page.tsx` — tank detail with charts + list
  - `tanks/[tankId]/report/page.tsx` — CSV export + print view
- `components/`
  - `TankProvider.tsx`, `TankSwitcher.tsx`, `QuickEntry.tsx`, `ReadingList.tsx`
  - `ReminderControls.tsx`, `NotificationsToggle.tsx`
  - `charts/MetricChart.tsx`, `charts/SmallMultiples.tsx`, `charts/TankSeries.tsx`
- `lib/`
  - `models.ts` — types, constants (kit steps, optimal ranges)
  - `idb.ts` — IndexedDB schema + CRUD helpers
  - `validation.ts` — rounding/clamping to kit steps
  - `series.ts` — rolling averages, anomaly helpers
  - `reminders.ts` — in‑app scheduling (due, snooze, skip)
  - `export.ts` — CSV generation
- `public/manifest.webmanifest`, `public/service-worker.js`, `public/icons/*`
- `styles/print.css`, `app/globals.css`
- Full task list and file map: `tasks/tasks-prd-aquarium-water-tracker.md`

## Data Schema (v1)
- Tank: `{ id, name, createdAt, archivedAt?, reminderCadence }`
- Reading: `{ id, tankId, ts, pH, ammonia, nitrite, nitrate, note? }`
- Settings (global): `{ units?, theme?, chartOptions? }`

Conventions
- Timestamps: ISO 8601 strings with zone offset; displayed in local time.
- Kit steps: pH 0.1; Ammonia 0.25 ppm; Nitrite 0.1 ppm; Nitrate 1.0 ppm.
- Optimal bands: pH 6.5–7.5; Ammonia 0; Nitrite 0; Nitrate 0–20 ppm (20–40 caution optional).

## CSV Export
- Headers: `tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note`
- Source: `lib/export.ts` and UI in `app/tanks/[tankId]/report/page.tsx`

## Testing
- Unit tests: `tests/lib/*.test.ts`
- Component tests: `tests/components/*.test.tsx`
- Run: `npm test`

## Accessibility & Theming
- Color‑blind‑friendly defaults, minimal charts, keyboardable inputs.
- Print CSS included for reports.

## Known Limitations & Next Steps
- Custom optimal ranges per tank not exposed in the UI yet (planned v1.1).
- Nitrate 20–40 ppm “caution” band is not separately styled in MetricChart.
- Charts are basic SVG for v1; zoom/pan and richer tooltips are out of scope.
- Notifications depend on browser support and user permission.

## Development Guidelines
- Follow `AGENTS.md` for goals, standards, and Definition of Done.
- Keep components small; move logic into `lib/` with tests.
- Align changes to `tasks/tasks-prd-aquarium-water-tracker.md` and update tests.

## License
MIT © 2025 Trey Causey. See `LICENSE` for details.
