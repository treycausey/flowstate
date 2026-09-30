'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { useTankReadings } from '@/lib/useTankReadings'
import { getEnvironment } from '@/lib/tank/environment'
import { devClockFromSearch } from '@/lib/tank/devOverrides'
import { reportActivity } from '@/lib/tank/events'
import { usePlantVitality } from '@/lib/plants/vitality'
import { useTankStock } from '@/lib/stock/forTank'
import { waterFromReadings, withPlantVitality } from '@/lib/tank/fromReadings'
import { DEFAULT_PREFS, loadTankPrefs, onTankPrefsChanged, type TankPrefs } from '@/lib/tank/prefs'
import type { PanelRect } from '@/components/tank/TankScene'

// The engine (WebGL, shaders, sim) loads only after first paint, so logging stays fast.
const TankScene = dynamic(() => import('@/components/tank/TankScene'), { ssr: false })

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
}

const SCROLL_SETTLE_MS = 150

type Box = { left: number; top: number; right: number; bottom: number }

/**
 * The region the betta must keep out of. On phones the panel is a bottom sheet, so the fish keeps to the
 * hero band above it. On desktop the panel counts as a full-height column: a wide panel (Charts) that
 * stops short of the bottom would otherwise leave a strip below it as the "largest" free rectangle, and
 * the fish would swim there instead of in the open water beside the panel.
 */
export function exclusionFor(r: Box, viewportWidth: number, viewportHeight: number): PanelRect {
  if (viewportWidth < 900) {
    // Never let the band collapse to nothing when the sheet is scrolled up.
    return {
      left: 0,
      right: viewportWidth,
      top: Math.max(r.top, viewportHeight * 0.3),
      bottom: viewportHeight * 2,
    }
  }
  return { left: r.left, right: r.right, top: 0, bottom: viewportHeight }
}

/** Measure the panel. */
export function usePanelRect(enabled: boolean): PanelRect | null {
  const [rect, setRect] = useState<PanelRect | null>(null)
  useEffect(() => {
    if (!enabled) return
    const panel = document.querySelector<HTMLElement>('.app-panel')
    if (!panel) return
    const measure = () => {
      const next = exclusionFor(
        panel.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
      )
      setRect((prev) =>
        prev &&
        Math.abs(prev.left - next.left) < 1 &&
        Math.abs(prev.right - next.right) < 1 &&
        Math.abs(prev.top - next.top) < 1 &&
        Math.abs(prev.bottom - next.bottom) < 1
          ? prev
          : next,
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(panel)
    window.addEventListener('resize', measure)
    // Scrolling moves the sheet top on every event; re-measure once it settles, so the
    // reduced-motion static frame (a 270-step sim) is not re-run per scroll event.
    let scrollTimer = 0
    const onScroll = () => {
      window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(measure, SCROLL_SETTLE_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      ro.disconnect()
      window.clearTimeout(scrollTimer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', onScroll)
    }
  }, [enabled])
  return rect
}

export default function TankHost() {
  const { activeTankId } = useTanks()
  // /dev/* pages mount their own scene; a second one would fight over the canvas slot.
  const onDevRoute = usePathname()?.startsWith('/dev/') ?? false
  const { readings } = useTankReadings(activeTankId)
  const [prefs, setPrefs] = useState<TankPrefs>(DEFAULT_PREFS)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [armed, setArmed] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [clock] = useState(() =>
    typeof window === 'undefined' ? null : devClockFromSearch(window.location.search),
  )

  useEffect(() => {
    let cancelled = false
    loadTankPrefs()
      .then((p) => !cancelled && setPrefs(p))
      .catch((err) => console.error('Failed to load tank settings', err))
      .finally(() => !cancelled && setPrefsLoaded(true))
    const off = onTankPrefsChanged(setPrefs)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  // Load the engine after first paint.
  const enabled = prefsLoaded && prefs.livingTank && !onDevRoute
  useEffect(() => {
    if (!enabled) return
    const w = window as IdleWindow
    let id: number
    if (w.requestIdleCallback) {
      id = w.requestIdleCallback(() => setArmed(true), { timeout: 1500 })
      return () => w.cancelIdleCallback?.(id)
    }
    id = window.setTimeout(() => setArmed(true), 300)
    return () => window.clearTimeout(id)
  }, [enabled])

  // "Days since last test" changes at midnight; refresh the derived water every few minutes.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 5 * 60_000)
    return () => window.clearInterval(id)
  }, [])

  // The page CSS reads the phase for its night theme, with the scene on, off, or not loaded yet.
  useEffect(() => {
    const set = () => {
      const e = getEnvironment(clock?.() ?? new Date(), { hemisphere: prefs.hemisphere })
      document.documentElement.dataset.tankPhase = e.phase
    }
    set()
    const id = window.setInterval(set, 60_000)
    return () => {
      // Leave data-tank-phase in place: deleting it on re-run would blink the theme.
      window.clearInterval(id)
    }
  }, [enabled, prefs.hemisphere, clock])

  // Any key or pointer press counts as activity (idle timer for the look-at-you egg).
  useEffect(() => {
    if (!enabled) return
    let last = 0
    const tick = () => {
      const t = performance.now()
      if (t - last < 500) return
      last = t
      reportActivity()
    }
    window.addEventListener('keydown', tick, { passive: true })
    window.addEventListener('pointerdown', tick, { passive: true })
    return () => {
      window.removeEventListener('keydown', tick)
      window.removeEventListener('pointerdown', tick)
    }
  }, [enabled])

  const liveStock = useTankStock(activeTankId)
  // `useTankStock` builds a new array every render; the scene re-plans only when the content changes.
  const stockKey = liveStock ? JSON.stringify(liveStock) : null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the content, not the identity
  const stock = useMemo(() => liveStock, [stockKey])
  const vitality = usePlantVitality(activeTankId)
  // Wait briefly for the stock so the tank does not flash the betta first; if it never loads,
  // show the betta rather than nothing.
  const [stockWaited, setStockWaited] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const id = window.setTimeout(() => setStockWaited(true), 1500)
    return () => window.clearTimeout(id)
  }, [enabled])
  const water = useMemo(
    () => withPlantVitality(waterFromReadings(readings ?? [], now), vitality),
    [readings, now, vitality],
  )
  const exclusion = usePanelRect(enabled && armed)

  if (!enabled || !armed || (stock === null && !stockWaited)) return null
  return (
    <TankScene
      water={water}
      stock={stock ?? undefined}
      exclusion={exclusion}
      hemisphere={prefs.hemisphere}
      clock={clock ?? undefined}
    />
  )
}
