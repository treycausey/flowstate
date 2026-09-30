// Maps the latest water tests onto the look and mood of the tank. Pure.

import type { Reading } from '@/lib/models'
import type { CycleStatus } from '@/lib/status'
import { calendarDaysBetween, tsMillis } from '@/lib/time'

export type Mood = 'thriving' | 'healthy' | 'dull' | 'stressed'

export type WaterState = {
  /** Milky grey-green veil, 0..1. */
  haze: number
  /** Green cast and hair algae, 0..1. */
  algae: number
  /** Sparkling clarity: glints and light shafts, 0..1. */
  sparkle: number
  /** Dust on the glass from neglect, 0..1. */
  dust: number
  mood: Mood
  bubbleNest: boolean
}

export type WaterInput = {
  cycle: CycleStatus
  latest: {
    pH: number | null
    ammonia: number | null
    nitrite: number | null
    nitrate: number | null
  }
  daysSinceLastTest: number | null
  goodStreakDays: number
}

export const NEUTRAL_WATER: WaterState = {
  haze: 0,
  algae: 0,
  sparkle: 0.3,
  dust: 0,
  mood: 'healthy',
  bubbleNest: false,
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Piecewise-linear through (nitrate ppm, algae): 20 -> 0, 25 -> 0.15, 40 -> 0.4, 80 -> 1. */
const ALGAE_POINTS: ReadonlyArray<readonly [number, number]> = [
  [20, 0],
  [25, 0.15],
  [40, 0.4],
  [80, 1],
]

export function algaeForNitrate(nitrate: number | null): number {
  if (nitrate === null || nitrate <= ALGAE_POINTS[0][0]) return 0
  for (let i = 1; i < ALGAE_POINTS.length; i++) {
    const [x0, y0] = ALGAE_POINTS[i - 1]
    const [x1, y1] = ALGAE_POINTS[i]
    if (nitrate <= x1) return y0 + ((nitrate - x0) / (x1 - x0)) * (y1 - y0)
  }
  return 1
}

export function dustForDays(days: number | null): number {
  if (days === null || days <= 7) return 0
  return clamp01((days - 7) / 23)
}

export function deriveWaterState(input: WaterInput): WaterState {
  const { latest, cycle } = input
  const nh3 = latest.ammonia ?? 0
  const no2 = latest.nitrite ?? 0
  const toxic = nh3 > 0 || no2 > 0
  const haze = toxic ? clamp01(0.35 + (0.4 * Math.max(nh3, no2)) / 1) : 0
  const algae = algaeForNitrate(latest.nitrate)
  const nitrateOk = (latest.nitrate ?? 0) <= 20
  const thriving = !toxic && cycle === 'cycled' && nitrateOk
  const mood: Mood = toxic ? 'stressed' : algae > 0.5 ? 'dull' : thriving ? 'thriving' : 'healthy'
  const sparkle = thriving ? 1 : clamp01(0.3 * (1 - haze) * (1 - algae))
  return {
    haze,
    algae,
    sparkle,
    dust: dustForDays(input.daysSinceLastTest),
    mood,
    bubbleNest: input.goodStreakDays >= 7,
  }
}

function inRange(r: Reading): boolean {
  if (r.ammonia !== null && r.ammonia !== 0) return false
  if (r.nitrite !== null && r.nitrite !== 0) return false
  if (r.nitrate !== null && r.nitrate > 20) return false
  if (r.pH !== null && (r.pH < 6.5 || r.pH > 7.5)) return false
  return true
}

/**
 * Days in the current unbroken run of in-range readings, counted from the latest reading back to the
 * start of the run (inclusive, so one good reading is 1). Untested days between tests count as good:
 * nobody tests daily. Any out-of-range reading ends the run.
 */
export function goodStreakDays(readings: Reading[]): number {
  if (readings.length === 0) return 0
  const newestFirst = readings.slice().sort((a, b) => tsMillis(b.ts) - tsMillis(a.ts))
  if (!inRange(newestFirst[0])) return 0
  let oldestGood = newestFirst[0]
  for (const r of newestFirst) {
    if (!inRange(r)) break
    oldestGood = r
  }
  return (
    calendarDaysBetween(new Date(tsMillis(oldestGood.ts)), new Date(tsMillis(newestFirst[0].ts))) +
    1
  )
}
