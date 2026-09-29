'use client'

import { useEffect, useState } from 'react'
import { listReadingsByTank } from '@/lib/idb'
import { onReadingsChanged } from '@/lib/events'
import type { Reading } from '@/lib/models'

/**
 * Loads a tank's readings (oldest first) and reloads on every change event for that tank.
 * `readings` is null until the tank's first load finishes, so a stale or unloaded list is
 * never mistaken for "no readings". A failed load is logged and reported through `failed`.
 */
export function useTankReadings(tankId: string | null): {
  readings: Reading[] | null
  failed: boolean
} {
  const [loaded, setLoaded] = useState<{ tankId: string; readings: Reading[] } | null>(null)
  const [failedTankId, setFailedTankId] = useState<string | null>(null)

  useEffect(() => {
    if (!tankId) return
    let mounted = true
    const load = async () => {
      try {
        const all = await listReadingsByTank(tankId)
        if (!mounted) return
        setFailedTankId(null)
        setLoaded({ tankId, readings: all })
      } catch (err) {
        console.error('Failed to load readings', err)
        if (mounted) setFailedTankId(tankId)
      }
    }
    load()
    const off = onReadingsChanged((changed) => {
      if (changed === tankId) load()
    })
    return () => {
      mounted = false
      off()
    }
  }, [tankId])

  if (!tankId) return { readings: null, failed: false }
  return {
    readings: loaded?.tankId === tankId ? loaded.readings : null,
    failed: failedTankId === tankId,
  }
}
