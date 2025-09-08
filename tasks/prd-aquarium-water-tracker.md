# PRD: Freshwater Aquarium Water Tracker (v1)

## 1) Overview

Track and visualize key freshwater aquarium chemistry over time to help hobbyists maintain healthy tanks. The app provides a low‑friction, mobile‑first way to log pH, Ammonia (NH3/NH4+), Nitrite (NO2−), and Nitrate (NO3−), then shows Tufte‑inspired, minimal charts with clearly indicated optimal ranges and out‑of‑range events. v1 is local‑only (no account), installable PWA, and supports multiple tanks for a single user.

## 2) Goals

- Make logging so fast that users actually do it.
- Reveal trends and out‑of‑range events early, reducing livestock stress.
- Provide clean, minimal, “Tufte‑approved” visualizations with optimal ranges.
- Operate completely offline with local data ownership; enable easy data export.

## 3) User Stories

- As a hobbyist with multiple tanks, I can add a reading for pH, Ammonia, Nitrite, and Nitrate in under 10 seconds so I keep consistent logs.
- As a user, I can see small, uncluttered time‑series charts with shaded optimal bands so I know whether my parameters are healthy.
- As a user, I can set a custom reminder cadence per tank so I remember to test during cycling and later on.
- As a user, I can export my data to CSV and print a 30/90‑day report to share with a vet/store or keep records.
- As a user, I can backdate entries when I forgot to log on the actual test day.

## 4) Functional Requirements

1. Tanks
   - FR‑1.1: Create, rename, archive tanks; default to first tank on install.
   - FR‑1.2: Per‑tank settings include display name and reminder cadence.

2. Quick Entry (low friction)
   - FR‑2.1: Single screen to enter values for pH, Ammonia, Nitrite, Nitrate with a single timestamp (defaults to “now”).
   - FR‑2.2: “Use last values” button pre‑fills the four fields with the prior reading for that tank; user can tweak before saving.
   - FR‑2.3: Inputs use kit‑friendly steps: pH 0.1; Ammonia 0.25 ppm; Nitrite 0.1 ppm; Nitrate 1.0 ppm. Allow free typing as well.
   - FR‑2.4: Optional notes text field (short, single line) per entry.
   - FR‑2.5: Support backdating (choose a past date/time) and editing/deleting any entry.
   - FR‑2.6: Prevent accidental duplicates by warning when saving multiple entries within the same hour; allow override.

3. Visualization (Tufte‑inspired)
   - FR‑3.1: Small multiples: one minimal time‑series per metric (4 panels) sharing the same time axis.
   - FR‑3.2: Show shaded optimal band per metric:
       - pH: 6.5–7.5
       - Ammonia: 0 ppm (render as a baseline band at 0 with highlight when > 0)
       - Nitrite: 0 ppm (same approach as Ammonia)
       - Nitrate: 0–20 ppm (shade as optimal; 20–40 caution line; >40 out‑of‑range)
   - FR‑3.3: Mark out‑of‑range points with subtle anomaly dots and list counts per metric.
   - FR‑3.4: Optional 7‑day rolling average toggle per panel.
   - FR‑3.5: Minimal design: thin lines, light grid or none, unobtrusive axes, high data‑ink ratio.
   - FR‑3.6: Tooltips on hover/tap show value, date/time, and note (if present).

4. Reminders
   - FR‑4.1: Per‑tank reminder schedules; presets: Daily (cycling), Every 3 days, Weekly, Custom N days.
   - FR‑4.2: In‑app reminder surface (badge/toast). System notifications where supported by the browser/PWA permissions.
   - FR‑4.3: Snooze (24h) and Skip actions.

5. Data Management
   - FR‑5.1: Local‑only storage; works fully offline.
   - FR‑5.2: Export CSV of all readings or a date‑bounded subset per tank.
   - FR‑5.3: Printable report (last 30 or 90 days) with charts and out‑of‑range summary.

6. Accessibility & Internationalization
   - FR‑6.1: Color‑blind‑safe palette; contrast AA for key text and markers.
   - FR‑6.2: Keyboard‑first data entry; logical tab order; large tap targets on mobile.
   - FR‑6.3: All timestamps stored and displayed in local timezone with ISO 8601 for export.

## 5) Non‑Goals (Out of Scope for v1)

- Hardware sensor integrations (probes/IoT).
- Water‑change scheduling, dosing calculators, or medication tracking.
- Social/community features or shared multi‑user accounts.
- Cloud sync/accounts; analytics beyond local aggregate summaries.

## 6) Design Considerations

- Tufte style: prioritize data‑ink. Remove nonessential chartjunk; thin, neutral axes; no heavy gridlines. Use subtle shading to communicate optimal ranges.
- Small multiples layout stacks the four metrics vertically; ensure consistent x‑axis to visually correlate shifts across metrics.
- Use muted line colors; anomalies appear as slightly larger, higher‑contrast points.
- Quick Entry places the four inputs in a compact, single column with large numeric steppers; primary action button at thumb‑reachable position.

## 7) Technical Considerations (non‑binding)

- Architecture: Local‑first PWA. IndexedDB (via a lightweight helper like `idb`) for durability; Service Worker for offline and installability.
- Charts: Lightweight custom SVG or a small charting lib that allows minimalist styling and small multiples without heavy dependencies.
- Data model (suggested):
  - Tank: `{ id, name, createdAt, archivedAt?, reminderCadence }`
  - Reading: `{ id, tankId, ts, pH, ammonia, nitrite, nitrate, note? }`
  - Settings (global): `{ units, theme, chartOptions }`
- Validation: Store numeric values as decimals; clamp to sensible ranges (e.g., pH 5–9 by default unless overridden in future versions).
- Time: Store `ts` as ISO string with zone offset; display using locale. Handle DST changes.
- Notifications: Implement in‑app reminders first; expose “Enable notifications” flow for systems that support PWA notifications.

## 8) Success Metrics

- Median log time < 10 seconds for Quick Entry.
- ≥ 2 readings per active tank per week after week 2.
- ≥ 80% of readings created via Quick Entry.
- Reduction in out‑of‑range events per tank over a 30‑day period for active users.

## 9) Acceptance Criteria (per major area)

- Quick Entry saves a four‑metric reading with default timestamp in ≤ two taps after values are pre‑filled.
- “Use last values” pulls the most recent reading for that tank and pre‑populates all fields.
- Users can backdate, edit, and delete readings; edits reflect immediately in charts and exports.
- Small multiples render with correct optimal bands and anomaly markers matching thresholds above.
- CSV export includes headers: `tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note` and roundings per kit steps.
- Printable report generates 30/90‑day PDFs with charts and counts of out‑of‑range points per metric.
- Reminders appear according to cadence even when offline; users can snooze/skip.
- App installs as a PWA and functions offline after first load.

## 10) Open Questions

- Do we want per‑tank custom optimal ranges in v1 or defer to v1.1? (Default is general freshwater ranges.)
- Should nitrate display an additional “caution” band (20–40 ppm) distinct from “optimal” and “high” for clarity?
- Any specific fish species presets we should include later (e.g., Discus, African cichlids)?
- Are there preferred color themes (light/dark) to include in v1?

