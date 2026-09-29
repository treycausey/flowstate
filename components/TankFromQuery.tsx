'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTanks } from '@/components/TankProvider'

/** Select the tank named by `?tankId=` (links, Tauri menu) once tanks are loaded. */
export default function TankFromQuery() {
  const tankId = useSearchParams()?.get('tankId')
  const { activeTanks, setActiveTankId } = useTanks()
  const known = !!tankId && activeTanks.some((t) => t.id === tankId)

  useEffect(() => {
    if (tankId && known) setActiveTankId(tankId)
  }, [tankId, known, setActiveTankId])

  return null
}
