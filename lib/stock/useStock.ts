import { listStockByTank, listStockEventsByTank } from '@/lib/idb'
import { onStockChanged } from '@/lib/events'
import { createSharedTankHook } from '@/lib/sharedTankStore'
import type { StockEvent, StockGroup } from '@/lib/models'

const useSharedStock = createSharedTankHook<{ groups: StockGroup[]; events: StockEvent[] }>({
  load: async (tankId) => {
    const [groups, events] = await Promise.all([
      listStockByTank(tankId),
      listStockEventsByTank(tankId),
    ])
    return { groups, events }
  },
  onChange: onStockChanged,
  errorLabel: 'Failed to load stock',
})

/**
 * Loads a tank's stock groups (removed ones included) and their events, and reloads on every
 * stock-changed event for that tank. All components watching the same tank share one load.
 * `groups` and `events` are null until the tank's first load finishes, so an unloaded list is
 * never mistaken for "no stock". A failed load is logged and reported through `failed`.
 */
export function useStock(tankId: string | null): {
  groups: StockGroup[] | null
  events: StockEvent[] | null
  failed: boolean
} {
  const { data, failed } = useSharedStock(tankId)
  return { groups: data?.groups ?? null, events: data?.events ?? null, failed }
}
