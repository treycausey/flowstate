// Living-tank preferences, persisted in the app settings store. Small change bus so the settings
// page and the tank host stay in sync without a reload.

import { getSettings, setSettings } from '@/lib/idb'
import type { Settings } from '@/lib/models'

export type TankPrefs = {
  livingTank: boolean
  hemisphere: 'north' | 'south'
  shimmerSeen: string[]
}

export const DEFAULT_PREFS: TankPrefs = { livingTank: true, hemisphere: 'north', shimmerSeen: [] }

const bus = new EventTarget()
let saveQueue: Promise<void> = Promise.resolve()

export function prefsFromSettings(s: Settings | undefined): TankPrefs {
  return {
    livingTank: s?.livingTank ?? DEFAULT_PREFS.livingTank,
    hemisphere: s?.hemisphere === 'south' ? 'south' : 'north',
    shimmerSeen: s?.shimmerSeen ?? [],
  }
}

export async function loadTankPrefs(): Promise<TankPrefs> {
  return prefsFromSettings(await getSettings())
}

/** Merge into the stored settings (other keys are kept) and notify listeners. */
export function saveTankPrefs(patch: Partial<TankPrefs>): Promise<TankPrefs> {
  const run = async () => {
    const current = (await getSettings()) ?? {}
    await setSettings({ ...current, ...patch })
    const next = prefsFromSettings({ ...current, ...patch })
    bus.dispatchEvent(new CustomEvent('change', { detail: next }))
    return next
  }
  // Serialize: each save reads the settings only after the previous write finished.
  const result = saveQueue.then(run, run)
  saveQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

/** Re-read the stored settings and notify listeners (after a backup import replaced them). */
export async function refreshTankPrefs(): Promise<TankPrefs> {
  const next = await loadTankPrefs()
  bus.dispatchEvent(new CustomEvent('change', { detail: next }))
  return next
}

export function onTankPrefsChanged(cb: (prefs: TankPrefs) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<TankPrefs>).detail)
  bus.addEventListener('change', handler)
  return () => bus.removeEventListener('change', handler)
}
