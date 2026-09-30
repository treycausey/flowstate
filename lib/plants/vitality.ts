import type { Plant, PlantCheck } from '@/lib/models'
import { latestCheckByPlant, tankPlantHealth } from './health'
import { usePlants } from './usePlants'

/**
 * How well the tank's plants are doing, 0 (all dead) to 1 (all thriving); null when the tank has
 * no active plants. Plants never checked count as OK, so a freshly planted tank reads calm, not
 * sick. The living tank reads this to tint its water and plants.
 */
export function plantVitalityForTank(plants: Plant[], checks: PlantCheck[]): number | null {
  return tankPlantHealth(plants, latestCheckByPlant(checks)).vitality
}

/**
 * Live vitality for a tank (see `plantVitalityForTank`). Null while loading, on a failed load,
 * and when the tank has no plants. Updates whenever plants or checks change.
 */
export function usePlantVitality(tankId: string | null): number | null {
  const { plants, checks } = usePlants(tankId)
  if (!plants || !checks) return null
  return plantVitalityForTank(plants, checks)
}
