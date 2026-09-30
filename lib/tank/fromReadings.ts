// Turns a tank's readings into the water state the living tank draws. Pure.

import type { Reading } from '@/lib/models'
import { tankStatus } from '@/lib/status'
import {
  NEUTRAL_WATER,
  deriveWaterState,
  goodStreakDays,
  type WaterState,
} from '@/lib/tank/waterState'

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
