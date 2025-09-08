"use client"

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const register = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
          if (reg.waiting) {
            const refresh = window.confirm('Update available. Reload now?')
            if (refresh) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing
            if (!sw) return
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                const refresh = window.confirm('A new version is ready. Reload?')
                if (refresh) window.location.reload()
              }
            })
          })
        } catch {
          // no-op
        }
      }
      register()
    }
  }, [])
  return null
}
