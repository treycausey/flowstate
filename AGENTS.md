# AGENTS.md — Flowstate

Audience: AI coding agents and contributors working in this repository.
Scope: Applies to the entire repo unless superseded by a more specific AGENTS.md deeper in the tree.

## Product Overview

Flowstate (v1) — a local‑first, installable PWA that lets a single user track freshwater aquarium chemistry for multiple tanks and see minimalist, Tufte‑inspired charts with optimal ranges and out‑of‑range highlights. All requirements and tasking live in `tasks/`.

Authoritative sources:

- PRD: `tasks/prd-aquarium-water-tracker.md` (Flowstate v1)
- Work plan and file map: `tasks/tasks-prd-aquarium-water-tracker.md`

## Core Principles (Do/Don’t)

- Do optimize for low‑friction logging (<10 seconds per entry).
- Do keep everything local (IndexedDB) and offline‑friendly; no cloud, auth, or analytics.
- Do favor minimalist charts and high data‑ink ratio; avoid chartjunk.
- Do maintain accessibility (color‑blind safe palette, AA contrast, keyboard support).
- Don’t add heavy charting dependencies; prefer custom SVG or a very small lib.
- Don’t exceed v1 scope (see Non‑Goals below) without explicit approval.

## Target Tech Stack (non‑binding but recommended)

- Framework: Next.js (App Router) + TypeScript.
- Storage: IndexedDB via a light helper (e.g., `idb`).
- PWA: Service Worker + `public/manifest.webmanifest`.
- Tests: Jest + React Testing Library.
  If an alternate stack is chosen, keep the same UX and data guarantees.

## Directory & Key Files (expected)

See `tasks/tasks-prd-aquarium-water-tracker.md` for the full map. Highlights:

- `app/page.tsx` — dashboard/recent readings.
- `app/tanks/page.tsx` — tank detail with small‑multiples (selection via query param).
- `app/tanks/report/page.tsx` — printable 30/90‑day report (query param selects tank).
- `components/QuickEntry.tsx` — single‑screen input for pH, NH3/NH4+, NO2‑, NO3‑ plus note.
- `components/TankSwitcher.tsx`, `components/ReminderControls.tsx`.
- `components/charts/MetricChart.tsx`, `components/charts/SmallMultiples.tsx`.
- `lib/idb.ts`, `lib/models.ts`, `lib/validation.ts`, `lib/series.ts`, `lib/export.ts`, `lib/report.tsx`, `lib/reminders.ts`, `lib/time.ts`.
- `app/globals.css`, `styles/print.css`, `public/service-worker.js`, `public/manifest.webmanifest`.
- `tests/**` for unit/component tests.

## Data Model (v1 expectations)

- Tank: `{ id, name, createdAt, archivedAt?, reminderCadence }`
- Reading: `{ id, tankId, ts, pH, ammonia, nitrite, nitrate, note? }`
- Settings: `{ units, theme, chartOptions }`
  Conventions:
- Store `ts` as ISO 8601 with zone offset. Display in local timezone.
- Numeric steps (kit‑friendly): pH 0.1; Ammonia 0.25 ppm; Nitrite 0.1 ppm; Nitrate 1.0 ppm.
- Duplicate guard: warn on multiple entries within the same hour; allow override.

## Visualization Rules

- Small multiples: one panel per metric sharing the same x‑axis.
- Optimal bands:
  - pH: 6.5–7.5
  - Ammonia: 0 ppm (highlight any > 0)
  - Nitrite: 0 ppm (highlight any > 0)
  - Nitrate: 0–20 ppm optimal; 20–40 ppm caution; > 40 ppm high
- Minimal styling: thin lines, subtle axes, light or no grid. Tooltip shows value, date/time, note.
- Optional: 7‑day rolling average toggle per panel.

## Reminders & Notifications

- Per‑tank cadence presets: Daily, Every 3 days, Weekly, Custom N days.
- In‑app reminders are required; PWA notifications where supported (permissions flow needed).
- Provide Snooze (24h) and Skip; persist per tank.

## CSV Export & Reports

- CSV headers: `tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note`.
- Reports: printable 30/90‑day with charts and out‑of‑range counts per metric.
- Include print styles and ensure good dark/light rendering on paper.

## Accessibility & i18n

- Color‑blind‑safe palette; verify AA contrast for key text/markers.
- Keyboard‑first data entry with logical tab order and large tap targets on mobile.
- Use locale‑aware time display; exports use ISO timestamps.

## Performance & Bundling

- Prefer custom SVG; avoid large charting libs. Keep additions lean.
- Code‑split as needed; tree‑shake utilities. Measure bundle size and interactions.

## Coding Standards

- TypeScript strict mode; no implicit any.
- Keep components small and pure; extract logic to `lib/`.
- No unnecessary abstractions; avoid premature optimization.
- Linting/formatting: ESLint + Prettier. Match existing patterns when present.
- Naming: descriptive, consistent; avoid one‑letter identifiers.

## Testing Strategy

- Unit tests: `lib/validation.ts`, `lib/series.ts`, `lib/time.ts`, `lib/export.ts`, `lib/reminders.ts`.
- Component tests: `QuickEntry`, `MetricChart`, `SmallMultiples`.
- Integration flows: create tank → add reading → visualize → export.
- Use fake IndexedDB/mocks for storage and SW registration.

## Definition of Done (v1)

A change is “done” when:

- It satisfies the relevant FRs in the PRD and updates/uses the expected files.
- Includes tests with meaningful coverage and passes locally.
- Preserves offline operation and local storage semantics.
- Meets accessibility and performance expectations.
- Updates README/inline docs where behavior or setup changed.

## Non‑Goals (v1)

- No hardware probes/IoT, dosing, medication tracking.
- No social features, multi‑user accounts, or cloud sync.
- No analytics beyond local aggregate summaries.

## Open Questions

- Per‑tank custom optimal ranges in v1 vs. v1.1.
- Whether to include an explicit nitrate 20–40 ppm caution band (PRD lists as optional).
- Species presets in the future; theme presets.
  Document decisions in PRs and, if needed, append a “Decision Log” section here.

## Agent Workflow Notes

- Treat `tasks/prd-aquarium-water-tracker.md` as the source of truth for scope and acceptance criteria. `tasks/tasks-prd-aquarium-water-tracker.md` is a stale, unmaintained checklist from before the September 2025 ship — do not use its checkbox state to judge what's built.
- Prefer surgical changes aligned to the file map; avoid broad refactors without need.
- When adding a new module, also add tests and, if needed, brief docs.
- Keep PRs small and cohesive; reference PRD sections and task IDs.

## Local Dev (suggested)

Once a framework is scaffolded:

- Install deps: `bun install`
- Dev server: `bun run dev`
- Tests: `bun run test`
- Lint/format: `bun run lint` / `bun run format` / `bun run format:check`
- Build: `bun run build`

This file is intended to keep future agents aligned with the PRD and task list. If you must deviate, update this AGENTS.md and the tasks checklist accordingly.
