import { listPlantChecksByTank, listPlantsByTank } from '@/lib/idb'
import { onPlantsChanged } from '@/lib/events'
import { createSharedTankHook } from '@/lib/sharedTankStore'
import type { Plant, PlantCheck } from '@/lib/models'

const useSharedPlants = createSharedTankHook<{ plants: Plant[]; checks: PlantCheck[] }>({
  load: async (tankId) => {
    const [plants, checks] = await Promise.all([
      listPlantsByTank(tankId),
      listPlantChecksByTank(tankId),
    ])
    return { plants, checks }
  },
  onChange: onPlantsChanged,
  errorLabel: 'Failed to load plants',
})

/**
 * Loads a tank's plants (removed ones included) and their health checks, and reloads on every
 * plants-changed event for that tank. All components watching the same tank share one load.
 * `plants` and `checks` are null until the tank's first load finishes, so an unloaded list is
 * never mistaken for "no plants". A failed load is logged and reported through `failed`.
 */
export function usePlants(tankId: string | null): {
  plants: Plant[] | null
  checks: PlantCheck[] | null
  failed: boolean
} {
  const { data, failed } = useSharedPlants(tankId)
  return { plants: data?.plants ?? null, checks: data?.checks ?? null, failed }
}
