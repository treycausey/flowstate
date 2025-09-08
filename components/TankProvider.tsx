"use client"

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { listTanks } from '@/lib/idb'
import type { Tank } from '@/lib/models'

type Ctx = {
  tanks: Tank[]
  activeTankId: string | null
  setActiveTankId: (id: string) => void
  refresh: () => Promise<void>
}

const TankContext = createContext<Ctx | null>(null)

export function TankProvider({ children }: { children: React.ReactNode }) {
  const [tanks, setTanks] = useState<Tank[]>([])
  const [activeTankId, setActiveTankIdState] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const all = await listTanks()
    setTanks(all)
    if (!activeTankId && all.length > 0) {
      setActiveTankIdState(all[0].id)
    }
  }, [activeTankId])

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('activeTankId') : null
    if (saved) setActiveTankIdState(saved)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActiveTankId = (id: string) => {
    setActiveTankIdState(id)
    if (typeof window !== 'undefined') localStorage.setItem('activeTankId', id)
  }

  const value = useMemo(
    () => ({ tanks, activeTankId, setActiveTankId, refresh }),
    [tanks, activeTankId, refresh]
  )

  return <TankContext.Provider value={value}>{children}</TankContext.Provider>
}

export function useTanks() {
  const ctx = useContext(TankContext)
  if (!ctx) throw new Error('useTanks must be used within TankProvider')
  return ctx
}
