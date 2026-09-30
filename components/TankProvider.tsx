'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ensureSeed, listTanks } from '@/lib/idb'
import type { Tank } from '@/lib/models'
import { errorText } from '@/lib/errors'

type Ctx = {
  /** All tanks, including archived ones */
  tanks: Tank[]
  /** Tanks that are not archived, in creation order */
  activeTanks: Tank[]
  activeTankId: string | null
  activeTank: Tank | null
  loaded: boolean
  /** Readable reason the tanks could not load (for example another tab blocks an upgrade) */
  loadError: string | null
  setActiveTankId: (id: string) => void
  refresh: () => Promise<void>
}

const TankContext = createContext<Ctx | null>(null)

/** All tanks, creating the default one on first run. */
async function loadTanks() {
  const all = await listTanks()
  if (all.length > 0) return all
  await ensureSeed()
  return listTanks()
}
const STORAGE_KEY = 'activeTankId'

function readSaved() {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  } catch {
    return null
  }
}

function persist(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // ignore: private mode / storage disabled
  }
}

export function TankProvider({ children }: { children: React.ReactNode }) {
  const [tanks, setTanks] = useState<Tank[]>([])
  // Lazy init is hydration-safe: nothing tank-specific renders until tanks load on the client
  const [selectedId, setSelectedId] = useState<string | null>(readSaved)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setTanks(await loadTanks())
    setLoadError(null)
    setLoaded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadTanks()
      .then((all) => !cancelled && setTanks(all))
      .catch((err) => {
        // Storage unavailable, blocked by another tab or newer than this code: say why rather
        // than spinning forever or showing a misleading empty state
        console.error('Failed to load tanks', err)
        if (!cancelled) setLoadError(errorText(err))
      })
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  const activeTanks = useMemo(() => tanks.filter((t) => !t.archivedAt), [tanks])

  // Fall back to the first unarchived tank when the saved/selected one is missing or archived
  const activeTank = useMemo(
    () => activeTanks.find((t) => t.id === selectedId) ?? activeTanks[0] ?? null,
    [activeTanks, selectedId],
  )
  const activeTankId = activeTank?.id ?? null

  const setActiveTankId = useCallback((id: string) => {
    setSelectedId(id)
    persist(id)
  }, [])

  const value = useMemo(
    () => ({
      tanks,
      activeTanks,
      activeTankId,
      activeTank,
      loaded,
      loadError,
      setActiveTankId,
      refresh,
    }),
    [tanks, activeTanks, activeTankId, activeTank, loaded, loadError, setActiveTankId, refresh],
  )

  return <TankContext.Provider value={value}>{children}</TankContext.Provider>
}

export function useTanks() {
  const ctx = useContext(TankContext)
  if (!ctx) throw new Error('useTanks must be used within TankProvider')
  return ctx
}
