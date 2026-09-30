// Turns a tank's readings into the water state the living tank draws. Pure.

import type { Reading } from '@/lib/models'
import { tankStatus } from '@/lib/status'
import {
  NEUTRAL_WATER,
  deriveWaterState,
  goodStreakDays,
  type WaterState,
} from '@/lib/tank/waterState'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Plants that are struggling dull the water a little (more algae, less sparkle); thriving plants
 * add a touch of sparkle. Null (no plants) and the middle range change nothing.
 */
export function withPlantVitality(water: WaterState, vitality: number | null): WaterState {
  if (vitality === null || !Number.isFinite(vitality)) return water
  if (vitality < 0.5) {
    const k = (0.5 - Math.max(0, vitality)) / 0.5
    return {
      ...water,
      algae: clamp01(water.algae + 0.15 * k),
      sparkle: clamp01(water.sparkle * (1 - 0.3 * k)),
    }
  }
  if (vitality > 0.8) {
    const k = (Math.min(1, vitality) - 0.8) / 0.2
    return { ...water, sparkle: clamp01(water.sparkle + 0.15 * k) }
  }
  return water
}

export function waterFromReadings(readings: Reading[], now: Date = new Date()): WaterState {
  if (readings.length === 0) return NEUTRAL_WATER
  const status = tankStatus(readings, now)
  return deriveWaterState({
    cycle: status.cycle,
    latest: {
      pH: status.metrics.pH.latest?.value ?? null,
      ammonia: status.metrics.ammonia.latest?.value ?? null,
      nitrite: status.metrics.nitrite.latest?.value ?? null,
      nitrate: status.metrics.nitrate.latest?.value ?? null,
    },
    daysSinceLastTest: status.daysSinceLastTest,
    goodStreakDays: goodStreakDays(readings),
  })
}
