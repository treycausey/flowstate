import { useEffect, useState } from 'react'
import { listStockByTank, listStockEventsByTank } from '@/lib/idb'
import { onStockChanged } from '@/lib/events'
import type { StockEvent, StockGroup } from '@/lib/models'

type Loaded = { tankId: string; groups: StockGroup[]; events: StockEvent[] }

/**
 * Loads a tank's stock groups (removed ones included) and their events, and reloads on every
 * stock-changed event for that tank. `groups` and `events` are null until the tank's first load
 * finishes, so an unloaded list is never mistaken for "no stock". A failed load is logged and
 * reported through `failed`.
 */
export function useStock(tankId: string | null): {
  groups: StockGroup[] | null
  events: StockEvent[] | null
  failed: boolean
} {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failedTankId, setFailedTankId] = useState<string | null>(null)

  useEffect(() => {
    if (!tankId) return
    let mounted = true
    const load = async () => {
      try {
        const [groups, events] = await Promise.all([
          listStockByTank(tankId),
          listStockEventsByTank(tankId),
        ])
        if (!mounted) return
        setFailedTankId(null)
        setLoaded({ tankId, groups, events })
      } catch (err) {
        console.error('Failed to load stock', err)
        if (mounted) setFailedTankId(tankId)
      }
    }
    load()
    const off = onStockChanged((changed) => {
      if (changed === tankId) load()
    })
    return () => {
      mounted = false
      off()
    }
  }, [tankId])

  if (!tankId) return { groups: null, events: null, failed: false }
  const current = loaded?.tankId === tankId ? loaded : null
  return {
    groups: current?.groups ?? null,
    events: current?.events ?? null,
    failed: failedTankId === tankId,
  }
}
