'use client'

import { useCallback, useSyncExternalStore } from 'react'

export type TankSnapshot<T> = { data: T | null; failed: boolean }

type Entry<T> = {
  snapshot: TankSnapshot<T>
  listeners: Set<() => void>
  off: () => void
  loading: boolean
  reloadQueued: boolean
}

const EMPTY: TankSnapshot<never> = { data: null, failed: false }

/**
 * Builds a hook that shares one load per tank among all components watching that tank.
 * Each change event for the tank triggers one reload; events that arrive during a load are
 * coalesced into a single follow-up reload. The entry exists only while someone watches the tank,
 * so a tank's data is never shown for another tank and nothing leaks after unmount.
 * A failed load keeps the previous data and sets `failed` until the next load succeeds.
 */
export function createSharedTankHook<T>(options: {
  load: (tankId: string) => Promise<T>
  onChange: (cb: (tankId: string) => void) => () => void
  errorLabel: string
}): (tankId: string | null) => TankSnapshot<T> {
  const entries = new Map<string, Entry<T>>()

  const run = async (tankId: string, entry: Entry<T>) => {
    entry.loading = true
    try {
      const data = await options.load(tankId)
      if (entries.get(tankId) !== entry) return
      entry.snapshot = { data, failed: false }
    } catch (err) {
      console.error(options.errorLabel, err)
      if (entries.get(tankId) !== entry) return
      entry.snapshot = { data: entry.snapshot.data, failed: true }
    } finally {
      entry.loading = false
    }
    entry.listeners.forEach((l) => l())
    if (entry.reloadQueued && entries.get(tankId) === entry) {
      entry.reloadQueued = false
      void run(tankId, entry)
    }
  }

  const subscribeTo = (tankId: string, listener: () => void) => {
    let entry = entries.get(tankId)
    if (!entry) {
      const created: Entry<T> = {
        snapshot: EMPTY,
        listeners: new Set(),
        off: () => {},
        loading: false,
        reloadQueued: false,
      }
      created.off = options.onChange((changed) => {
        if (changed !== tankId) return
        if (created.loading) created.reloadQueued = true
        else void run(tankId, created)
      })
      entries.set(tankId, created)
      entry = created
      void run(tankId, created)
    }
    entry.listeners.add(listener)
    return () => {
      const current = entries.get(tankId)
      if (!current) return
      current.listeners.delete(listener)
      if (current.listeners.size === 0) {
        current.off()
        entries.delete(tankId)
      }
    }
  }

  return function useShared(tankId) {
    const subscribe = useCallback(
      (listener: () => void) => (tankId ? subscribeTo(tankId, listener) : () => {}),
      [tankId],
    )
    const getSnapshot = useCallback(
      () => (tankId ? (entries.get(tankId)?.snapshot ?? EMPTY) : EMPTY),
      [tankId],
    )
    return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
  }
}
