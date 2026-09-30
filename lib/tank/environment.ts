// Time-of-day, season, moon and holiday state for the living tank. Pure: everything derives from a Date.

export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Holiday = null | 'halloween' | 'winter' | 'newyear'
export type Hemisphere = 'north' | 'south'

export type Environment = {
  phase: Phase
  /** 0..1 through the current phase (night runs 20:30 -> 05:30). */
  phaseProgress: number
  /** Local decimal hours 0..24. */
  hours: number
  light: {
    /** 0..1 overall light level (moonlight keeps night above 0). */
    intensity: number
    /** Kelvin. Low is warm, high is cool. */
    colorTemp: number
    /** Unit vector in screen space (y down) along which light travels. */
    sunDir: [number, number]
  }
  season: Season
  moon: { phase: number; illumination: number }
  holiday: Holiday
}

export type EnvironmentOptions = { hemisphere?: Hemisphere }

export const PHASE_START = { dawn: 5.5, day: 8, dusk: 18, night: 20.5 } as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function phaseAt(hours: number): { phase: Phase; progress: number } {
  if (hours >= PHASE_START.dawn && hours < PHASE_START.day) {
    return {
      phase: 'dawn',
      progress: (hours - PHASE_START.dawn) / (PHASE_START.day - PHASE_START.dawn),
    }
  }
  if (hours >= PHASE_START.day && hours < PHASE_START.dusk) {
    return {
      phase: 'day',
      progress: (hours - PHASE_START.day) / (PHASE_START.dusk - PHASE_START.day),
    }
  }
  if (hours >= PHASE_START.dusk && hours < PHASE_START.night) {
    return {
      phase: 'dusk',
      progress: (hours - PHASE_START.dusk) / (PHASE_START.night - PHASE_START.dusk),
    }
  }
  const sinceNight =
    hours >= PHASE_START.night ? hours - PHASE_START.night : hours + 24 - PHASE_START.night
  const nightLength = 24 - PHASE_START.night + PHASE_START.dawn
  return { phase: 'night', progress: sinceNight / nightLength }
}

export function seasonAt(date: Date, hemisphere: Hemisphere = 'north'): Season {
  const month = date.getMonth() // 0 = January
  const north: Season =
    month >= 2 && month <= 4
      ? 'spring'
      : month >= 5 && month <= 7
        ? 'summer'
        : month >= 8 && month <= 10
          ? 'autumn'
          : 'winter'
  if (hemisphere === 'north') return north
  const flip: Record<Season, Season> = {
    spring: 'autumn',
    summer: 'winter',
    autumn: 'spring',
    winter: 'summer',
  }
  return flip[north]
}

const SYNODIC_MONTH = 29.530588853
// A known new moon: 2000-01-06 18:14 UTC.
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14)

/** phase 0 = new, 0.5 = full; illumination 0..1. */
export function moonAt(date: Date) {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000
  const phase = (((days / SYNODIC_MONTH) % 1) + 1) % 1
  return { phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2 }
}

export function holidayAt(date: Date): Holiday {
  const m = date.getMonth()
  const d = date.getDate()
  const h = date.getHours()
  if (m === 9 && d === 31) return 'halloween'
  if (m === 11 && d >= 24 && d <= 26) return 'winter'
  if ((m === 11 && d === 31 && h >= 22) || (m === 0 && d === 1 && h < 2)) return 'newyear'
  return null
}

/** Light level from local hours. Smooth so the grade never steps. */
function intensityAt(hours: number, moonIllumination: number) {
  const day = smoothstep(5.0, 8.5, hours) * (1 - smoothstep(17.5, 20.5, hours))
  const moonlight = 0.06 + 0.1 * moonIllumination
  return lerp(moonlight, 1, day)
}

function colorTempAt(hours: number) {
  // Warm at the edges of the day, neutral at noon, cool blue at night.
  const noonness = 1 - Math.min(1, Math.abs(hours - 13) / 6.5)
  const day = lerp(3600, 5900, smoothstep(0, 0.7, noonness))
  const night = 9500
  const daylight = smoothstep(5.0, 7.5, hours) * (1 - smoothstep(19, 21.5, hours))
  return lerp(night, day, daylight)
}

function sunDirAt(hours: number): [number, number] {
  // The dawn plate is lit from the upper left, the day and dusk plates from the upper right.
  const morning = 1 - smoothstep(6, 8.8, hours)
  const x = lerp(-0.2 - 0.34 * clamp01((hours - 8.8) / 11), 0.55, morning)
  const y = 1
  const len = Math.hypot(x, y)
  return [x / len, y / len]
}

export function getEnvironment(
  date: Date = new Date(),
  options: EnvironmentOptions = {},
): Environment {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const { phase, progress } = phaseAt(hours)
  const moon = moonAt(date)
  return {
    phase,
    phaseProgress: progress,
    hours,
    light: {
      intensity: intensityAt(hours, moon.illumination),
      colorTemp: colorTempAt(hours),
      sunDir: sunDirAt(hours),
    },
    season: seasonAt(date, options.hemisphere ?? 'north'),
    moon,
    holiday: holidayAt(date),
  }
}
