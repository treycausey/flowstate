import { useEffect, useState } from 'react'

/**
 * A fresh `Date` on every render. The component re-renders each minute and when the page
 * becomes visible again, so "today" stays correct across midnight without new events.
 */
export function useNow(): Date {
  const [, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    const timer = setInterval(bump, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return new Date()
}
