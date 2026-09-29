import { METRICS, type Metric, type Reading } from './models'
import { isOutOfRange } from './series'

export type SummaryCounts = Record<Metric, number>

export function filterReadingsByDays(readings: Reading[], days: number | 'all', now = new Date()) {
  if (days === 'all') return readings
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
  return readings.filter((r) => new Date(r.ts).getTime() >= cutoff)
}

/** Out-of-range count per metric, ignoring metrics that weren't tested. */
export function summarizeOutOfRange(readings: Reading[]): SummaryCounts {
  return countBy(readings, (m, v) => isOutOfRange(m, v))
}

/** How many readings actually tested each metric. */
export function summarizeTested(readings: Reading[]): SummaryCounts {
  return countBy(readings, () => true)
}

function countBy(readings: Reading[], match: (m: Metric, value: number) => boolean) {
  const acc: SummaryCounts = { pH: 0, ammonia: 0, nitrite: 0, nitrate: 0 }
  for (const r of readings) {
    for (const m of METRICS) {
      const v = r[m]
      if (v !== null && v !== undefined && match(m, v)) acc[m]++
    }
  }
  return acc
}
