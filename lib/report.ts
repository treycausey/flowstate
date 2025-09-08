import type { Reading } from './models'
import { isOutOfRange } from './series'

export type SummaryCounts = {
  pH: number
  ammonia: number
  nitrite: number
  nitrate: number
}

export function filterReadingsByDays(readings: Reading[], days: number | 'all', now = new Date()) {
  if (days === 'all') return readings
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return readings.filter((r) => new Date(r.ts) >= cutoff)
}

export function summarizeOutOfRange(readings: Reading[]): SummaryCounts {
  return readings.reduce<SummaryCounts>(
    (acc, r) => {
      if (isOutOfRange('pH', r.pH)) acc.pH++
      if (isOutOfRange('ammonia', r.ammonia)) acc.ammonia++
      if (isOutOfRange('nitrite', r.nitrite)) acc.nitrite++
      if (isOutOfRange('nitrate', r.nitrate)) acc.nitrate++
      return acc
    },
    { pH: 0, ammonia: 0, nitrite: 0, nitrate: 0 },
  )
}

