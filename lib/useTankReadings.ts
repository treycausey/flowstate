'use client'

import { listReadingsByTank } from '@/lib/idb'
import { onReadingsChanged } from '@/lib/events'
import { createSharedTankHook } from '@/lib/sharedTankStore'
import type { Reading } from '@/lib/models'

const useSharedReadings = createSharedTankHook<Reading[]>({
  load: listReadingsByTank,
  onChange: onReadingsChanged,
  errorLabel: 'Failed to load readings',
})

/**
 * A tank's readings (oldest first), reloaded on every change event for that tank. All components
 * watching the same tank share one load per change. `readings` is null until the tank's first
 * load finishes, so a stale or unloaded list is never mistaken for "no readings". A failed load
 * is logged and reported through `failed`.
 */
export function useTankReadings(tankId: string | null): {
  readings: Reading[] | null
  failed: boolean
} {
  const { data, failed } = useSharedReadings(tankId)
  return { readings: data, failed }
}
