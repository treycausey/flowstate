import { NITRATE_CAUTION_MAX, OPTIMAL, type Metric, type Reading } from './models'

export type Point = { ts: string; value: number; note?: string }

export function rollingAverage(points: Point[], windowDays: number): Point[] {
  if (windowDays <= 1) return points
  const windowMs = (windowDays - 1) * 24 * 60 * 60 * 1000
  const times = points.map((p) => new Date(p.ts).getTime())
  return points.map((p, i) => {
    const curr = times[i]
    const from = curr - windowMs
    let sum = 0
    let n = 0
    for (let j = 0; j < points.length; j++) {
      if (times[j] >= from && times[j] <= curr) {
        sum += points[j].value
        n++
      }
    }
    return { ...p, value: Number((sum / (n || 1)).toFixed(3)) }
  })
}

export function isOutOfRange(metric: Metric, value: number) {
  if (metric === 'ammonia' || metric === 'nitrite') return value > 0
  const band: { min?: number; max?: number } = OPTIMAL[metric]
  if (band.min !== undefined && value < band.min) return true
  if (band.max !== undefined && value > band.max) return true
  return false
}

export type Severity = 'ok' | 'caution' | 'high'

/** Nitrate distinguishes 20–40 ppm (caution) from > 40 ppm (high); other metrics are ok/high. */
export function severity(metric: Metric, value: number): Severity {
  if (!isOutOfRange(metric, value)) return 'ok'
  if (metric === 'nitrate' && value <= NITRATE_CAUTION_MAX) return 'caution'
  return 'high'
}

/**
 * Y domain for a metric. pH always shows its optimal band; ppm metrics start at 0
 * (negative concentrations are meaningless) with headroom above the max.
 */
export function domainY(metric: Metric, values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite)
  if (metric === 'pH') {
    const min = Math.min(OPTIMAL.pH.min, ...finite)
    const max = Math.max(OPTIMAL.pH.max, ...finite)
    return [Math.floor((min - 0.2) * 10) / 10, Math.ceil((max + 0.2) * 10) / 10]
  }
  const max = finite.length ? Math.max(...finite) : 0
  const floorMax = metric === 'nitrate' ? OPTIMAL.nitrate.max : 1
  const top = Math.max(floorMax, max * 1.1)
  return [0, niceCeil(top)]
}

function niceCeil(v: number) {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * mag >= v - 1e-9) return Number((m * mag).toFixed(6))
  }
  return 10 * mag
}

export function anomalyCount(metric: Metric, points: Point[]) {
  return points.reduce((n, p) => n + (isOutOfRange(metric, p.value) ? 1 : 0), 0)
}

export type MetricSeries = Record<Metric, Point[]>

/** Per-metric series; readings where a metric wasn't tested are skipped for that metric. */
export function readingsToSeries(readings: Reading[]): MetricSeries {
  const pick = (m: Metric): Point[] =>
    readings.flatMap((r) => {
      const value = r[m]
      if (value === null || value === undefined) return []
      return [{ ts: r.ts, value, ...(r.note ? { note: r.note } : {}) }]
    })
  return {
    pH: pick('pH'),
    ammonia: pick('ammonia'),
    nitrite: pick('nitrite'),
    nitrate: pick('nitrate'),
  }
}
