import { useEffect, useState } from 'react'
import { listPlantChecksByTank, listPlantsByTank } from '@/lib/idb'
import { onPlantsChanged } from '@/lib/events'
import type { Plant, PlantCheck } from '@/lib/models'

type Loaded = { tankId: string; plants: Plant[]; checks: PlantCheck[] }

/**
 * Loads a tank's plants (removed ones included) and their health checks, and reloads on every
 * plants-changed event for that tank. `plants` and `checks` are null until the tank's first load
 * finishes, so an unloaded list is never mistaken for "no plants". A failed load is logged and
 * reported through `failed`.
 */
export function usePlants(tankId: string | null): {
  plants: Plant[] | null
  checks: PlantCheck[] | null
  failed: boolean
} {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failedTankId, setFailedTankId] = useState<string | null>(null)

  useEffect(() => {
    if (!tankId) return
    let mounted = true
    const load = async () => {
      try {
        const [plants, checks] = await Promise.all([
          listPlantsByTank(tankId),
          listPlantChecksByTank(tankId),
        ])
        if (!mounted) return
        setFailedTankId(null)
        setLoaded({ tankId, plants, checks })
      } catch (err) {
        console.error('Failed to load plants', err)
        if (mounted) setFailedTankId(tankId)
      }
    }
    load()
    const off = onPlantsChanged((changed) => {
      if (changed === tankId) load()
    })
    return () => {
      mounted = false
      off()
    }
  }, [tankId])

  if (!tankId) return { plants: null, checks: null, failed: false }
  const current = loaded?.tankId === tankId ? loaded : null
  return {
    plants: current?.plants ?? null,
    checks: current?.checks ?? null,
    failed: failedTankId === tankId,
  }
}
