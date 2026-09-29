import { METRICS, type Metric, type Reading } from './models'
import { calendarDaysBetween, compareTs, tsMillis } from './time'

export type Trend = 'up' | 'down' | 'flat' | null

export type TestedValue = { value: number; ts: string }

export type MetricStatus = {
  /** Most recent reading that tested this metric. */
  latest: TestedValue | null
  /** The tested value before `latest`. */
  previous: TestedValue | null
  /** `latest` compared with `previous`; null when fewer than two tests exist. */
  trend: Trend
}

export type CycleStatus = 'not-started' | 'cycling' | 'nearly-cycled' | 'cycled'

export type TankStatus = {
  metrics: Record<Metric, MetricStatus>
  /** Local calendar days since the newest reading of any kind; null with no readings. */
  daysSinceLastTest: number | null
  cycle: CycleStatus
}

/** Consecutive ammonia 0 / nitrite 0 tests needed before a tank counts as cycled. */
export const CYCLED_ZERO_TESTS = 3

const isNum = (v: number | null | undefined): v is number => v !== null && v !== undefined

function sortedOldestFirst(readings: Reading[]) {
  return readings.slice().sort(compareTs)
}

/** Tested values for one metric, oldest first; readings that skipped it are ignored. */
function testedValues(sorted: Reading[], metric: Metric): TestedValue[] {
  return sorted.flatMap((r) => {
    const value = r[metric]
    return isNum(value) ? [{ value, ts: r.ts }] : []
  })
}

function trendOf(latest: TestedValue | undefined, previous: TestedValue | undefined): Trend {
  if (!latest || !previous) return null
  const diff = latest.value - previous.value
  if (Math.abs(diff) < 1e-9) return 'flat'
  return diff > 0 ? 'up' : 'down'
}

export function metricStatus(readings: Reading[], metric: Metric): MetricStatus {
  const tested = testedValues(sortedOldestFirst(readings), metric)
  const latest = tested.at(-1)
  const previous = tested.at(-2)
  return {
    latest: latest ?? null,
    previous: previous ?? null,
    trend: trendOf(latest, previous),
  }
}

/** Local calendar days between the newest reading and `now`, never negative. Null with no readings. */
export function daysSinceLastTest(readings: Reading[], now = new Date()): number | null {
  if (readings.length === 0) return null
  const newest = Math.max(...readings.map((r) => tsMillis(r.ts)))
  return calendarDaysBetween(new Date(newest), now)
}

/**
 * Nitrogen-cycle status, from the whole reading history (untested metrics are skipped):
 *
 * - cycling:       the latest tested ammonia is above 0, or the latest tested nitrite is above 0
 *                  (even if the other has never been tested).
 * - not-started:   otherwise, if ammonia or nitrite has never been tested.
 * - cycled:        the latest 3 readings that tested both ammonia and nitrite were all 0/0,
 *                  and a nitrate result above 0 has been seen (the bacteria are producing nitrate).
 * - nearly-cycled: both have been tested and are at 0 now, but the cycled test is not met yet
 *                  (fewer than 3 consecutive 0/0 tests, or nitrate has never been above 0).
 */
export function cycleStatus(readings: Reading[]): CycleStatus {
  const sorted = sortedOldestFirst(readings)
  const ammonia = testedValues(sorted, 'ammonia').at(-1)
  const nitrite = testedValues(sorted, 'nitrite').at(-1)
  if ((ammonia?.value ?? 0) > 0 || (nitrite?.value ?? 0) > 0) return 'cycling'
  if (!ammonia || !nitrite) return 'not-started'

  const paired = sorted.filter((r) => isNum(r.ammonia) && isNum(r.nitrite))
  const lastThree = paired.slice(-CYCLED_ZERO_TESTS)
  const zeroStreak =
    lastThree.length === CYCLED_ZERO_TESTS &&
    lastThree.every((r) => r.ammonia === 0 && r.nitrite === 0)
  const nitrateSeen = sorted.some((r) => isNum(r.nitrate) && r.nitrate > 0)
  return zeroStreak && nitrateSeen ? 'cycled' : 'nearly-cycled'
}

export function tankStatus(readings: Reading[], now = new Date()): TankStatus {
  const metrics = {} as Record<Metric, MetricStatus>
  for (const m of METRICS) metrics[m] = metricStatus(readings, m)
  return {
    metrics,
    daysSinceLastTest: daysSinceLastTest(readings, now),
    cycle: cycleStatus(readings),
  }
}
