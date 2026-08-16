'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { isTauri } from '@/lib/tauri'
import { useTanks } from '@/components/TankProvider'
import { mapNavToPath } from '@/lib/tauri-nav'

export default function TauriNavigationBridge() {
  const router = useRouter()
  const { activeTankId } = useTanks()

  useEffect(() => {
    if (!isTauri()) return
    let unlisten: null | (() => void) = null
    ;(async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const off = await listen<string>('navigate', (event) => {
          const target = String(event.payload || '').toLowerCase()
          const path = mapNavToPath(target, activeTankId)
          if (path) router.push(path as Route)
        })
        unlisten = off
      } catch {
        // ignore: running in web or failed to load tauri api
      }
    })()
    return () => {
      try {
        if (unlisten) unlisten()
      } catch {}
    }
  }, [activeTankId, router])

  return null
}
