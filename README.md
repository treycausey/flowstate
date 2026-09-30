# Flowstate (PWA + Tauri Desktop + iOS)

Local-first app to log freshwater aquarium chemistry and visualize trends with minimalist charts.

- Browser/PWA: IndexedDB + Service Worker; no accounts or cloud.
- Desktop and iOS (Tauri 2): Real SQLite database file stored in the OS app data directory.

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
- **Stock**: record the fish, shrimp and snails in a tank, tap Fed, and get gentle tips (see below)
- **Plants**: learn about plants, add them to a tank, and keep a health history (see below)

## Project Structure (selected)

- `app/` Next.js App Router
  - `page.tsx` — log page: tank switcher, Quick Entry, recent readings, reminders
  - `tanks/page.tsx` — charts + full reading list (optional `tankId` query selects the tank)
  - `tanks/report/page.tsx` — printable report with charts and CSV export (optional `tankId` query)
  - `stock/page.tsx` — Stock tab: my stock, group pages, Learn (the view lives in the query string)
  - `plants/page.tsx` — Plants tab: my plants, plant pages, Learn (the view lives in the query string)
  - `settings/page.tsx` — storage info and JSON backup/restore
- `components/`
  - `TankProvider.tsx` (loads tanks, seeds the first tank, tracks the active one), `NavBar.tsx`
  - `TankSwitcher.tsx`, `TankFromQuery.tsx`, `QuickEntry.tsx`, `ReadingList.tsx`
  - `ReminderControls.tsx`, `NotificationsToggle.tsx`
  - `charts/MetricChart.tsx`, `charts/SmallMultiples.tsx`, `charts/TankSeries.tsx`
  - `stock/*` — Stock tab (`StockClient.tsx`), picker, group detail, Fed row, guidance flags, report section
  - `plants/*` — Plants tab (`PlantsClient.tsx`), picker, health check dialog, care card, status line
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
  - `stock/catalog.ts` — the built-in 22-species stock catalog; `stock/guidance.ts` — schooling,
    betta, water-fit and stocking rules; `stock/forTank.ts` — `stockForTank` and `useTankStock`
    for the living tank
  - `plants/catalog.ts` — the built-in 24-species catalog; `plants/health.ts` — symptoms,
    `diagnose`, `tankPlantHealth`; `plants/vitality.ts` — `plantVitalityForTank` and
    `usePlantVitality` for the living tank
- `public/manifest.webmanifest`, `public/service-worker.js`, `public/icons/*`
- `styles/print.css`, `app/globals.css`

## Living tank

Behind the panel is a small WebGL2 aquarium with a betta. It follows the time of day, the season, and your latest water tests: ammonia or nitrite makes the water hazy and the fish pale, high nitrate greens the water, and a long gap since the last test dusts the glass. Focusing a field makes the fish look your way, and saving a reading drops it a pellet.

- Turn it off in Settings > Living tank (no WebGL runs; the page shows a still picture). Pick your hemisphere there for the seasons.
- It follows the system Reduce Motion setting (one still frame).
- The engine loads after first paint, so logging stays fast.
- The bubble nest, autumn leaf, night shrimp and algae are image patches baked into the tank art (`public/tank/patch-*.webp`, described in `patches.json`). Each loads only when it is needed.
- Dev only: `?tankPhase=dawn|day|dusk|night` and `?tankDate=2026-12-31T23:59:30` (local time) override the clock, and `/dev/tank` is a control drawer.

There are easter eggs. Spoilers below.

<details>
<summary>Easter eggs</summary>

- Tap the betta and it flares. Tap elsewhere in the tank and it looks there.
- At night it rests against the moss, and a red shrimp comes out.
- In autumn a catappa leaf floats at the surface.
- After a 7-day streak of in-range tests it builds a bubble nest.
- Leave the app idle for 2 minutes (by day) and the betta swims up to look at you.
- Full moon nights have brighter moonbeams.
- Type "betta" in the Note field for a happy flare and a loop-the-loop.
- Around midnight on New Year (Dec 31 23:59 to Jan 1 00:10) bubbles burst from the substrate.
- On Halloween night the tank glows faintly orange and the betta flares once when the page opens.
- Log a tank's 100th reading and a golden shimmer passes through the water, once per tank.

</details>

## Stock

The **Stock** tab (between Charts and Plants) records the animals that really live in a tank, so you can feed and tend them and the tank can show them.

- **My stock**: one group per species ("6 × Neon tetra"), with its zone, when it was added, its latest health and any guidance flags. The top row shows "Fed today at 8:10" with a big **Fed** button: one tap records a whole-tank feeding and drops a pellet into the living tank.
- **Add stock**: search the catalog (filters: betta-safe, fish, shrimp, snails, zone), tap an animal, and save. The count is prefilled with the species' minimum group size. "Add something else" makes a custom animal that needs only a name.
- **Group page**: care card, guidance for this group, history, and the actions Observe (health and note), Lost, Rehome, Added more, Edit, Remove or Restore. Lost, Rehome and Added more change the count in the same step; a group with no animals left moves to "Left the tank". Deleting a group for good is only in Edit and asks first.
- **Tank volume**: set it in litres in Settings or under the overview on My stock (US gallons are shown as a helper). With a volume set, the tab shows a rough stocking estimate: light, moderate or heavy. It is a guide, not a rule.
- **Guidance** (`lib/stock/guidance.ts`): groups below the species' minimum ("Neon tetras are calmer in groups of 6 or more"); tankmates that may not suit a betta; a second betta; species whose temperature or pH ranges do not overlap, or a logged pH outside a species' range; and the temperature and pH range the stocked species share (temperature is not logged, so this compares species with each other).
- **Learn**: the catalog, a care page per animal and a short "Stocking basics" primer.
- The Log screen's status shows "Stock: 11 animals · fed today" (or "not fed today") and links to the tab, and the printable report has a Stock section. Medication and treatment tracking are not part of Flowstate.
- Cut-outs are `public/tank/fish/<id>.webp` (ids are in `lib/stock/catalog.ts`). The page reads that folder at build time, so a missing image shows a small drawing instead of a broken image.
- For the living tank scene, `lib/stock/forTank.ts` exports `stockForTank(groups)` and the hook `useTankStock(tankId)`, which updates on every `stock-changed` event.

Catalog values are conservative, widely quoted hobby figures (comfortable ranges, not survival limits). They are general guidance, not a rulebook.

## Plants

The **Plants** tab (between Charts and Report) helps you learn about, plant and look after the plants in a tank.

- **My plants**: the tank's plants grouped by placement (foreground, midground, background, floating, epiphyte), each with its latest health and "Check due" after 14 days without a check. Removing a plant keeps it in history under "Removed" and can be undone. Deleting one for good is only in Edit and asks first.
- **Add plant**: search the catalog (filters: easy only, low light, betta-friendly, placement), tap a plant, and save. Placement and planting date are prefilled. A custom plant needs only a name and a placement.
- **Check health**: pick how the plant looks, optionally add symptoms, what you did and a note. If you picked symptoms, a short list of likely causes appears with a gentle suggestion, and links the water-related ones to your latest test ("Nitrate tested 0 ppm on Sep 29").
- **Learn**: the whole catalog, a care page per plant (light, CO₂, growth, pH, temperature, height, planting, care, propagation, betta-tank fit, common problems) and a short "Plant basics" primer.
- The Log screen's status shows a one-line plants summary that links to the tab, and the printable report lists the plants with their latest health.
- Plant photos, if present, are `public/plants/<id>.webp` (ids are in `lib/plants/catalog.ts`). The page reads that folder at build time, so a missing photo shows a small drawing instead of a broken image.

The guidance is general hobby knowledge phrased as "often" and "likely". It is not a diagnosis and **not a dosing tool**: Flowstate never gives or tracks fertiliser amounts.

## Data Schema (v1)

- Tank: `{ id, name, createdAt, archivedAt?, reminderCadence, volumeL? }` (`volumeL` is litres)
- Reading: `{ id, tankId, ts, pH, ammonia, nitrite, nitrate, note? }` (each metric is `number | null`; `null` = not tested, at least one is non-null)
- Plant: `{ id, tankId, speciesId | null, name, placement, plantedAt, removedAt?, note? }` (`speciesId` is a catalog id, null for a custom plant; `removedAt` set = removed, not deleted)
- PlantCheck: `{ id, plantId, tankId, ts, health, symptoms[], action?, note? }` (`health` is thriving, ok, struggling, melting or dead)
- StockGroup: `{ id, tankId, speciesId | null, name, count, addedAt, removedAt?, note? }` (one row per species group; `count` is 0 once every animal is lost or rehomed, and then `removedAt` is set)
- StockEvent: `{ id, tankId, stockId | null, ts, kind, countDelta?, health?, note? }` (`kind` is fed, observed, health, lost, rehomed or added; `stockId` null is a whole-tank event such as feeding; lost, rehomed and added change the group's count in the same transaction)
- Settings (global): `{ units?, theme?, chartOptions? }`
- Storage versions: IndexedDB is version 3 (version 2 added `plants` and `plantChecks`; version 3 adds `stock` and `stockEvents`; an upgrade keeps all data). The desktop SQLite schema is `user_version` 4 (adds `stock`, `stock_events` and a nullable `tanks.volumeL`). JSON backups include `plants`, `plantChecks`, `stock` and `stockEvents`; older backups without them still import.

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

## Desktop and iOS (Tauri 2)

One Tauri 2 project (`src-tauri/`) builds the macOS app and the iOS app. The frontend is the static
export (`out/`). The service worker is not registered inside Tauri.

- Prereqs: Rust toolchain, Xcode and `xcodegen` (iOS). `@tauri-apps/cli` is a devDependency.
- Desktop dev: `bun run tauri:dev` (starts `next dev` on 127.0.0.1:4040 and a window)
- Desktop build: `bun run tauri:build -- --bundles app` produces
  `src-tauri/target/release/bundle/macos/Flowstate.app`
- Rust tests: `cargo test` in `src-tauri`

### iOS

- Bundle id `dev.flowstate.app`, team `VT79RNNS2U`, minimum iOS 15. The generated Xcode project is in
  `src-tauri/gen/apple`.
- Simulator: `bunx tauri ios dev "iPhone 17 Pro Max"` (live reload from the Next dev server).
- Device: `scripts/ios-build-device.sh` builds a release app, stamps `CFBundleVersion` with
  `git rev-list --count HEAD`, and packages `tmp/Flowstate.ipa` (it avoids
  `xcodebuild -exportArchive`). Install with airship. The script prints the `.ipa` path and checks the
  stamp and the embedded provisioning profile. The keychain must be unlocked.
- Settings, About shows `Build <n> · <hash>`, read from the `app_build_info` command.
- Version pins: the Tauri crates (`~2.11`) and the `@tauri-apps/*` packages must share major.minor versions
  (`tauri ios build` refuses mismatches). `Cargo.lock` keeps `swift-rs` at 1.0.7 so the vendored patch applies.
- Xcode 27 workarounds: `src-tauri/vendor/` holds patched copies of `swift-rs` and `tao` (same as the
  Stash app). Remove them when upstream releases cover the fixes.

Where data lives

| Platform  | Storage   | Location                                                                        |
| --------- | --------- | ------------------------------------------------------------------------------- |
| Web / PWA | IndexedDB | The browser profile (clearing site data deletes it)                             |
| macOS app | SQLite    | `~/Library/Application Support/dev.flowstate.app/flowstate.db`                  |
| iOS app   | SQLite    | The app container, `Library/Application Support/dev.flowstate.app/flowstate.db` |

- The web code detects Tauri at runtime (`window.__TAURI_INTERNALS__`) and routes all storage calls to
  SQLite via Rust `invoke('sqlite_*', ...)` commands (implemented with `rusqlite` in
  `src-tauri/src/db.rs`, wired up as Tauri commands in `src-tauri/src/lib.rs`). Desktop and iOS share
  that path. Settings, Storage shows the path the app opened.
- Move data between devices with a JSON backup (Settings, Backup & Migrate). On iOS the save dialog
  is not available, so export falls back to the web download path.

Schema migration

- The desktop database tracks its schema in `PRAGMA user_version`. On launch, a database from
  before partial readings (version 0) is rebuilt in one transaction so the metric columns accept
  `NULL`; every existing row is kept unchanged. Version 3 adds the plant tables and touches no
  existing rows. New databases start at the current version. DB code
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
