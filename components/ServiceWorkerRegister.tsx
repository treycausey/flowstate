'use client'

import { useEffect } from 'react'
import { isTauri } from '@/lib/tauri'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // The desktop app bundles its assets; a SW there would only serve stale builds
    if (!('serviceWorker' in navigator) || isTauri()) return
    // Pages are network-first and static chunks are content-hashed, so an updated worker can
    // take over without a forced reload (which could discard a half-entered reading).
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {
      // registration failures (private mode, file://) just mean no offline support
    })
  }, [])
  return null
}
