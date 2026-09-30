export type Tank = {
  id: string
  name: string
  createdAt: string
  archivedAt?: string | null
  reminderCadence?: number | null // days; null means disabled
}

/** A metric's value, or null when that test wasn't run for this reading. */
export type MetricValue = number | null

/** At least one metric is non-null; see `hasAnyMetric`. */
export type Reading = {
  id: string
  tankId: string
  ts: string // UTC ISO 8601 (normalized on write)
  pH: MetricValue
  ammonia: MetricValue // ppm
  nitrite: MetricValue // ppm
  nitrate: MetricValue // ppm
  note?: string
}

export type Settings = {
  units?: 'metric' | 'imperial'
  theme?: 'light' | 'dark' | 'system'
  chartOptions?: {
    rollingAverageDays?: number
  }
  /** Living tank scene. Off means CSS plate only, no WebGL. Default on. */
  livingTank?: boolean
  /** Which hemisphere's seasons the tank follows. Default north. */
  hemisphere?: 'north' | 'south'
  /** Tank ids that have already seen the 100th-reading shimmer. */
  shimmerSeen?: string[]
}

export type Dump = {
  tanks: Tank[]
  readings: Reading[]
  settings?: Settings
}

export type Metric = 'pH' | 'ammonia' | 'nitrite' | 'nitrate'

export const METRICS: readonly Metric[] = ['pH', 'ammonia', 'nitrite', 'nitrate']

export function hasAnyMetric(r: Pick<Reading, Metric>) {
  return METRICS.some((m) => r[m] !== null && r[m] !== undefined)
}

export const METRIC_LABEL: Record<Metric, string> = {
  pH: 'pH',
  ammonia: 'Ammonia (NH3/NH4+)',
  nitrite: 'Nitrite (NO2−)',
  nitrate: 'Nitrate (NO3−)',
}

export const METRIC_SHORT: Record<Metric, string> = {
  pH: 'pH',
  ammonia: 'NH3',
  nitrite: 'NO2',
  nitrate: 'NO3',
}

// Kit-friendly step sizes (used for input arrow keys / steppers)
export const STEP = {
  pH: 0.1,
  ammonia: 0.25,
  nitrite: 0.1,
  nitrate: 1.0,
} as const

// Plausible input bounds per metric; values outside are rejected rather than silently clamped
export const BOUNDS: Record<Metric, { min: number; max: number }> = {
  pH: { min: 5, max: 9 },
  ammonia: { min: 0, max: 10 },
  nitrite: { min: 0, max: 10 },
  nitrate: { min: 0, max: 200 },
}

// Optimal bands (defaults for freshwater)
export const OPTIMAL = {
  pH: { min: 6.5, max: 7.5 },
  ammonia: { max: 0 },
  nitrite: { max: 0 },
  nitrate: { min: 0, max: 20 },
}

// Nitrate above the optimal band but below this is "caution"; above is "high"
export const NITRATE_CAUTION_MAX = 40
