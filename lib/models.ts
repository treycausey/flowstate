export type Tank = {
  id: string
  name: string
  createdAt: string
  archivedAt?: string | null
  reminderCadence?: number | null // days; null means disabled
}

export type Reading = {
  id: string
  tankId: string
  ts: string // ISO 8601 with zone offset
  pH: number
  ammonia: number // ppm
  nitrite: number // ppm
  nitrate: number // ppm
  note?: string
}

export type Settings = {
  units?: 'metric' | 'imperial'
  theme?: 'light' | 'dark' | 'system'
  chartOptions?: {
    rollingAverageDays?: number
  }
}

export type Dump = {
  tanks: Tank[]
  readings: Reading[]
  settings?: Settings
}

// Kit-friendly step sizes
export const STEP = {
  pH: 0.1,
  ammonia: 0.25,
  nitrite: 0.1,
  nitrate: 1.0,
} as const

// Optimal bands (defaults for freshwater)
export const OPTIMAL = {
  pH: { min: 6.5, max: 7.5 },
  ammonia: { max: 0 },
  nitrite: { max: 0 },
  nitrate: { min: 0, max: 20 },
}
