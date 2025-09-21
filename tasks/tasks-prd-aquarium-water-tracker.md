## Relevant Files (Flowstate v1)

- `app/page.tsx` - Dashboard with recent readings, per-tank quick actions.
- `app/tanks/page.tsx` - Tank detail: small-multiples charts, metrics list, quick entry launcher (select tank via `tankId` query).
- `app/tanks/report/page.tsx` - Printable 30/90-day report view (print styles applied; tank via `tankId` query).
- `components/QuickEntry.tsx` - Single-screen entry for pH, Ammonia, Nitrite, Nitrate with notes.
- `components/TankSwitcher.tsx` - Picker for active tank; create/rename/archive controls.
- `components/ReminderControls.tsx` - Per-tank cadence presets and custom N-day input.
- `components/charts/MetricChart.tsx` - Minimal SVG chart for one metric with optimal band + anomalies.
- `components/charts/SmallMultiples.tsx` - Layout four MetricChart instances with shared x-axis and toggles.
- `lib/idb.ts` - IndexedDB wrapper (e.g., using `idb`), schema migrations, CRUD helpers.
- `lib/models.ts` - TS types/interfaces for Tank, Reading, Settings; constants for ranges/steps.
- `lib/validation.ts` - Value clamping, outlier checks, duplicate detection, rounding to kit steps.
- `lib/series.ts` - Rolling average, resampling/gap handling, anomaly detection helpers.
- `lib/export.ts` - CSV export utilities and filename conventions.
- `lib/report.tsx` - Report composition helpers (charts + summaries) for print view.
- `lib/reminders.ts` - Reminder scheduling, snooze/skip tracking, notification enable flow.
- `lib/time.ts` - ISO timestamp helpers, timezone/DST-safe display formatting.
- `app/globals.css` - Base styles, color-safe palette, dark/light themes, print styles import.
- `styles/print.css` - Print CSS for report pages.
- `public/manifest.webmanifest` - PWA manifest (name, icons, theme colors, display mode).
- `public/icons/*` - App icons of required sizes.
- `public/service-worker.js` - Service worker (Workbox build or custom) for offline caching + notifications.
- `tests/lib/*.test.ts` - Unit tests for lib modules (validation, series, time, export).
- `tests/components/*.test.tsx` - Component tests (QuickEntry, MetricChart, SmallMultiples).

### Notes

- Co-locate tests with code or under `tests/`; ensure Jest + RTL setup works in chosen framework.
- Use `npx jest [optional/path]` to run tests.

## Tasks

- [ ] 1.0 Project Setup & PWA Scaffolding
  - [ ] 1.1 Initialize repo with chosen framework (e.g., Next.js App Router + TS).
  - [ ] 1.2 Add TypeScript, ESLint, Prettier, Jest + React Testing Library config.
  - [ ] 1.3 Add PWA manifest (`public/manifest.webmanifest`) and icons.
  - [ ] 1.4 Add service worker scaffold (`public/service-worker.js`) and registration.
  - [ ] 1.5 Configure build to copy SW/manifest and enable offline by default.
  - [ ] 1.6 Add `app/globals.css` with base tokens, color variables, and print import.

- [ ] 2.0 Local-First Storage Layer (IndexedDB) & Data Model
  - [ ] 2.1 Define data model in `lib/models.ts` for Tank, Reading, Settings.
  - [ ] 2.2 Implement `lib/idb.ts` with versioned schema (tanks, readings, settings stores).
  - [ ] 2.3 Write CRUD helpers: tanks (create/rename/archive/list), readings (add/listByTank/range/update/delete).
  - [ ] 2.4 Add simple seed/init logic for first tank on fresh install.
  - [ ] 2.5 Unit tests for idb helpers using fake IndexedDB.

- [ ] 3.0 Tank Management
  - [ ] 3.1 Build `TankSwitcher` with list + create/rename/archive actions.
  - [ ] 3.2 Persist per-tank settings: display name, reminder cadence.
  - [ ] 3.3 Empty-state UX for first-time users.
  - [ ] 3.4 Tests: creation, rename, archive behavior and persistence.

- [ ] 4.0 Quick Entry Flow
  - [ ] 4.1 Create `QuickEntry` component with four numeric inputs + notes.
  - [ ] 4.2 Default timestamp to now; allow backdate date/time picker.
  - [ ] 4.3 “Use last values” pre-fill from most recent reading for tank.
  - [ ] 4.4 Input stepping to match kits: pH 0.1; NH3/NH4+ 0.25 ppm; NO2- 0.1 ppm; NO3- 1.0 ppm.
  - [ ] 4.5 Save action writes a single reading across four metrics under one timestamp.
  - [ ] 4.6 Tests: prefill, rounding/steps, save flow.

- [ ] 5.0 Readings CRUD & Validation
  - [ ] 5.1 Implement edit/delete of readings from tank detail list.
  - [ ] 5.2 Duplicate guard: warn when multiple entries within same hour; allow override.
  - [ ] 5.3 Validation/clamping per metric with sensible ranges; allow free-type with bounds.
  - [ ] 5.4 Tests: duplicate detection, clamping, edit persistence.

- [ ] 6.0 Visualization: Small Multiples with Optimal Bands + Anomalies
  - [ ] 6.1 Implement `MetricChart` (SVG) with thin line, minimal axes, tooltip on hover/tap.
  - [ ] 6.2 Implement shaded optimal bands per metric: pH 6.5–7.5; NH3=0; NO2=0; NO3 0–20 (optional 20–40 caution line).
  - [ ] 6.3 Implement anomaly markers for out-of-range points and counts per metric.
  - [ ] 6.4 Optional 7-day rolling average toggle; compute in `lib/series.ts`.
  - [ ] 6.5 Implement `SmallMultiples` to render four panels with shared x-axis.
  - [ ] 6.6 Tests: series utils, band thresholds, anomaly counting.

- [ ] 7.0 Reminders & Notifications
  - [ ] 7.1 `ReminderControls` UI with presets (Daily, 3 days, Weekly, Custom N days).
  - [ ] 7.2 Implement reminder scheduler in `lib/reminders.ts` (in-app toasts/badges).
  - [ ] 7.3 Permissions flow to enable PWA notifications where supported; fallback to in-app.
  - [ ] 7.4 Snooze (24h) and Skip actions; persist state per tank.
  - [ ] 7.5 Tests: schedule calculations, snooze/skip logic.

- [ ] 8.0 Export & Reports
  - [ ] 8.1 Implement CSV export in `lib/export.ts` with headers: tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note.
  - [ ] 8.2 Add export control on tank page; support date range filter.
  - [ ] 8.3 Build `/report` page with last 30/90-day views and summary counts.
  - [ ] 8.4 Add `styles/print.css` for printer-friendly charts and summaries.
  - [ ] 8.5 Tests: CSV formatting, report summaries.

- [ ] 9.0 Offline & Caching
  - [ ] 9.1 Configure service worker for app shell caching and route/data strategies.
  - [ ] 9.2 Cache versioning and update flow with “New version available” prompt.
  - [ ] 9.3 Ensure charts/data work offline after first load; verify fallback UX.
  - [ ] 9.4 Tests: SW registration mock and cache strategy smoke tests.

- [ ] 10.0 Accessibility & Theming
  - [ ] 10.1 Color-blind-safe palette; high-contrast markers for anomalies.
  - [ ] 10.2 Keyboard-first flows and proper focus states; labels and aria for inputs.
  - [ ] 10.3 Dark/light themes; persist preference.
  - [ ] 10.4 Tests: axe checks on key views, keyboard nav.

- [ ] 11.0 Time & Locale Handling
  - [ ] 11.1 Implement `lib/time.ts` for ISO strings with zone offsets; format display per locale.
  - [ ] 11.2 Ensure backdating and edits preserve original timestamp semantics.
  - [ ] 11.3 Handle DST and timezone changes safely; document expectations.
  - [ ] 11.4 Tests: parsing/formatting across timezone and DST boundaries.

- [ ] 12.0 Performance & Bundle Size
  - [ ] 12.1 Keep charting implementation lightweight; no large dependencies.
  - [ ] 12.2 Code-split routes/components where helpful; tree-shake utilities.
  - [ ] 12.3 Measure bundle and interaction performance; budget and regressions.

- [ ] 13.0 Testing Strategy
  - [ ] 13.1 Unit tests for lib modules (validation, series, time, export, reminders).
  - [ ] 13.2 Component tests (QuickEntry, MetricChart, SmallMultiples).
  - [ ] 13.3 Integration tests for flows: create tank → add reading → visualize → export.
  - [ ] 13.4 Set up CI to run tests on push/PR.

- [ ] 14.0 Documentation & Handover
  - [ ] 14.1 README with setup, build, and PWA install instructions.
  - [ ] 14.2 Data schema and export format documentation.
  - [ ] 14.3 Known limitations and next-steps (custom ranges, species presets).
