import type { StockGroup } from '@/lib/models'
import { stockSpecies } from './catalog'
import { activeGroups } from './guidance'
import type { StockKind, StockZone } from './types'
import { useStock } from './useStock'

/** What the living tank scene needs to know about one group of animals. */
export type TankStockEntry = {
  /** Catalog id, or null for a custom species. */
  speciesId: string | null
  count: number
  zone: StockZone
  kind: StockKind
}

/**
 * The animals now in the tank, for the scene. Active groups only (not removed, count above 0).
 * A custom species has no catalog entry, so it reads as a fish in the middle of the tank.
 */
export function stockForTank(groups: readonly StockGroup[]): TankStockEntry[] {
  return activeGroups(groups).map((g) => {
    const species = stockSpecies(g.speciesId)
    return {
      speciesId: species ? species.id : null,
      count: g.count,
      zone: species?.zone ?? 'middle',
      kind: species?.kind ?? 'fish',
    }
  })
}

/**
 * Live stock for a tank (see `stockForTank`). Null while loading and on a failed load, so the
 * scene can tell "not known yet" from "empty". Updates on every `stock-changed` event.
 */
export function useTankStock(tankId: string | null): TankStockEntry[] | null {
  const { groups } = useStock(tankId)
  if (!groups) return null
  return stockForTank(groups)
}
