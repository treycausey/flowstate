'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { BettaSim, type BettaFrame, type Rect } from '@/lib/tank/betta'
import { getEnvironment, type Environment, type Hemisphere } from '@/lib/tank/environment'
import { tankEvents } from '@/lib/tank/events'
import { fishWidthFor, TankRenderer } from '@/lib/tank/renderer'
import type { WaterState } from '@/lib/tank/waterState'

/** Where the betta beds down at night, in plate uv (the leaf hammock, upper right). */
const REST_PLATE: [number, number] = [0.72, 0.3]
/** Focal point of the plate. On phones the right side (where the fish lives) stays visible. */
const FOCAL_WIDE: [number, number] = [0.5, 0.5]
const FOCAL_NARROW: [number, number] = [0.72, 0.5]

export type PanelRect = { left: number; top: number; right: number; bottom: number }

export type TankSceneControls = {
  flare(): void
  inspect(): void
  /** Ask the betta to look at a random point. */
  focusRandom(): void
  frame(): BettaFrame | null
}

export type ScriptedEvent = {
  t: number
  type: 'flare' | 'pellet' | 'inspect' | 'focus' | 'blur' | 'look'
  /** Normalised view coordinates, for pellet, focus and look. */
  x?: number
  y?: number
}

export type TankSceneProps = {
  water: WaterState
  /** Panel rectangle in CSS pixels; the betta swims around it. */
  exclusion?: PanelRect | null
  /** Override the clock (dev drawer). */
  environment?: Environment
  hemisphere?: Hemisphere
  /** Render one deterministic frame at this sim time and stop. */
  freezeAt?: number | null
  /** Events replayed into the sim before a frozen frame (dev screenshots). */
  freezeScript?: ScriptedEvent[]
  /** Force the reduced-motion single frame. */
  reducedMotion?: boolean
  seed?: number
  controlsRef?: RefObject<TankSceneControls | null>
  onStats?: (stats: { fps: number; frameMs: number; level: 'full' | 'half' }) => void
}

const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="button"], [data-tank-ignore]'

function webgl2Available() {
  return typeof window !== 'undefined' && typeof WebGL2RenderingContext !== 'undefined'
}

export default function TankScene({
  water,
  exclusion = null,
  environment,
  hemisphere = 'north',
  freezeAt = null,
  freezeScript,
  reducedMotion,
  seed = 1,
  controlsRef,
  onStats,
}: TankSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [supported, setSupported] = useState(true)
  // The canvas mounts in the layout's #tank-canvas-slot when there is one, else fixed on <body>.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!webgl2Available()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- capability is only known on the client
      setSupported(false)
      return
    }
    setHost(document.getElementById('tank-canvas-slot') ?? document.body)
  }, [])

  // Latest props, read by the loop without re-creating it.
  const live = useRef({
    water,
    exclusion,
    environment,
    hemisphere,
    freezeAt,
    freezeScript,
    reducedMotion,
    onStats,
  })
  useEffect(() => {
    live.current = {
      water,
      exclusion,
      environment,
      hemisphere,
      freezeAt,
      freezeScript,
      reducedMotion,
      onStats,
    }
  })
  const api = useRef<{ dirty: () => void; configure: () => void } | null>(null)

  // The page's CSS reads data-tank-phase (fallback plate, night theme), with or without WebGL.
  useEffect(() => {
    const set = () => {
      const e = environment ?? getEnvironment(new Date(), { hemisphere })
      document.documentElement.dataset.tankPhase = e.phase
    }
    set()
    const id = window.setInterval(set, 60_000)
    return () => {
      window.clearInterval(id)
      delete document.documentElement.dataset.tankPhase
    }
  }, [environment, hemisphere])

  useEffect(() => {
    api.current?.dirty()
    api.current?.configure()
  }, [water, exclusion, environment, hemisphere, freezeAt, freezeScript, reducedMotion])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !host) return

    let renderer: TankRenderer | null = null
    let rafId = 0
    let disposed = false
    let staticFrameQueued = false

    const sim = new BettaSim(seed)
    let frame: BettaFrame = sim.frame()
    let elapsed = 0
    let lastTs = 0
    let ripple: { x: number; y: number; t0: number } | null = null
    let width = 0
    let height = 0
    let env: Environment = live.current.environment ?? getEnvironment(new Date(), { hemisphere })
    let envStamp = 0

    // Adaptive frame pacing.
    let level: 'full' | 'half' = 'full'
    let skip = false
    const deltas: number[] = []
    let halfSince = 0
    let statFrames = 0
    let statStart = 0
    let statMs = 0

    const isStatic = () => {
      const l = live.current
      if (l.freezeAt !== null && l.freezeAt !== undefined) return true
      if (l.reducedMotion !== undefined) return l.reducedMotion
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    }

    const currentEnv = (now: number) => {
      const l = live.current
      if (l.environment) return l.environment
      if (now - envStamp > 1000 || !env) {
        env = getEnvironment(new Date(), { hemisphere: l.hemisphere })
        envStamp = now
      }
      return env
    }

    const normRect = (r: PanelRect | null | undefined): Rect | null =>
      r && width > 0 && height > 0
        ? { x0: r.left / width, y0: r.top / height, x1: r.right / width, y1: r.bottom / height }
        : null

    const configure = () => {
      if (!renderer || width === 0) return
      const l = live.current
      const rest = renderer.plateToView(REST_PLATE[0], REST_PLATE[1])
      sim.configure({
        aspect: width / height,
        fishWidth: fishWidthFor(width),
        exclusion: normRect(l.exclusion),
        restSpot: { x: rest[0], y: rest[1] },
      })
      const e = l.environment ?? env
      sim.setContext({ night: e.phase === 'night', mood: l.water.mood })
      renderer.setPhase(e.phase)
    }

    const draw = () => {
      if (!renderer || width === 0) return
      const l = live.current
      const e = currentEnv(performance.now())
      renderer.setPhase(e.phase)
      renderer.render({
        time: elapsed,
        env: e,
        water: l.water,
        betta: frame,
        fishWidth: fishWidthFor(width),
        ripple,
        instant: isStatic(),
      })
    }

    const runStatic = () => {
      staticFrameQueued = false
      if (!renderer || disposed) return
      const l = live.current
      const target = l.freezeAt ?? 9
      // Deterministic: fresh sim stepped in fixed 1/30 s slices.
      const fresh = new BettaSim(seed)
      const rest = renderer.plateToView(REST_PLATE[0], REST_PLATE[1])
      fresh.configure({
        aspect: width / height,
        fishWidth: fishWidthFor(width),
        exclusion: normRect(l.exclusion),
        restSpot: { x: rest[0], y: rest[1] },
      })
      const e = l.environment ?? getEnvironment(new Date(), { hemisphere: l.hemisphere })
      fresh.setContext({ night: e.phase === 'night', mood: l.water.mood })
      let f = fresh.frame()
      const steps = Math.round(target * 30)
      const script = [...(l.freezeScript ?? [])].sort((a, b) => a.t - b.t)
      let next = 0
      for (let i = 0; i < steps; i++) {
        while (next < script.length && script[next].t <= i / 30) {
          const ev = script[next++]
          const at = { x: ev.x ?? 0.5, y: ev.y ?? 0.4 }
          if (ev.type === 'flare') fresh.flare()
          else if (ev.type === 'pellet') fresh.dropPellet(ev.x === undefined ? undefined : at)
          else if (ev.type === 'inspect') fresh.triggerInspect()
          else if (ev.type === 'focus') fresh.focusAt(at)
          else if (ev.type === 'look') fresh.lookAt(at)
          else fresh.blur()
        }
        f = fresh.step(1 / 30)
      }
      frame = f
      elapsed = target
      env = e
      draw()
    }

    const requestStatic = () => {
      if (staticFrameQueued) return
      staticFrameQueued = true
      requestAnimationFrame(runStatic)
    }

    const loop = (ts: number) => {
      rafId = 0
      if (disposed || document.hidden) return
      if (lastTs === 0) lastTs = ts
      const delta = Math.min(0.25, (ts - lastTs) / 1000)
      lastTs = ts
      rafId = requestAnimationFrame(loop)

      // Pacing: 60 fps unless frames arrive slower than ~45 fps, then 30 fps. Retry full rate later.
      deltas.push(delta * 1000)
      if (deltas.length > 40) deltas.shift()
      if (deltas.length >= 30) {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
        if (level === 'full' && avg > 22) {
          level = 'half'
          halfSince = ts
          deltas.length = 0
        } else if (level === 'half' && ts - halfSince > 15_000) {
          level = 'full'
          deltas.length = 0
        }
      }
      skip = !skip
      if (level === 'half' && skip) return

      const t0 = performance.now()
      const step = level === 'half' ? delta : delta
      elapsed += step
      frame = sim.step(step)
      draw()
      statMs = statMs * 0.9 + (performance.now() - t0) * 0.1
      statFrames++
      if (t0 - statStart > 500) {
        live.current.onStats?.({
          fps: (statFrames * 1000) / (t0 - statStart),
          frameMs: statMs,
          level,
        })
        statFrames = 0
        statStart = t0
      }
    }

    const start = () => {
      if (rafId || disposed || isStatic()) return
      lastTs = 0
      rafId = requestAnimationFrame(loop)
    }

    const stop = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }

    const inSlot = host !== document.body
    const measure = () => {
      width = inSlot ? host.clientWidth : window.innerWidth
      height = inSlot ? host.clientHeight : window.innerHeight
    }
    const resize = () => {
      if (!renderer) return
      measure()
      if (width === 0 || height === 0) return
      const dprCap = width < 900 ? 1.25 : 1.5
      renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, dprCap))
      const narrow = width / height < 1.2
      renderer.setFocal(...(narrow ? FOCAL_NARROW : FOCAL_WIDE))
      configure()
      if (isStatic()) requestStatic()
    }

    renderer = TankRenderer.create(canvas, () => {
      if (isStatic()) requestStatic()
    })
    if (!renderer) {
      setSupported(false)
      return
    }
    const r = renderer
    // Load in priority order: plate (first), betta, then the rest.
    const initialEnv = currentEnv(performance.now())
    r.setPhase(initialEnv.phase)
    void r
      .loadImage('betta-cruise')
      .then(() =>
        Promise.all([
          r.loadImage('betta-flare'),
          r.loadImage('betta-clamped'),
          r.loadImage('fg-stems'),
          r.loadImage('shrimp'),
          r.loadImage('leaf'),
          r.loadImage('nest'),
          r.loadImage('algae'),
        ]),
      )
    resize()
    api.current = { dirty: () => isStatic() && requestStatic(), configure }
    if (controlsRef) {
      controlsRef.current = {
        flare: () => sim.flare(),
        inspect: () => sim.triggerInspect(),
        focusRandom: () => {
          const rnd = Math.random
          sim.focusAt({ x: 0.35 + rnd() * 0.55, y: 0.25 + rnd() * 0.5 })
          window.setTimeout(() => sim.blur(), 6000)
        },
        frame: () => frame,
      }
    }

    // Input.
    const toNorm = (x: number, y: number) => ({ x: x / width, y: y / height })
    const offPellet = tankEvents.on('pellet', ({ at }) =>
      sim.dropPellet(at ? toNorm(at.x, at.y) : undefined),
    )
    const offTap = tankEvents.on('tap', ({ x, y }) => handleTap(x, y))
    const offFocus = tankEvents.on('focus', ({ x, y }) => sim.focusAt(toNorm(x, y)))
    const offBlur = tankEvents.on('blur', () => sim.blur())
    const offActivity = tankEvents.on('activity', () => sim.activity())

    function handleTap(x: number, y: number) {
      const n = toNorm(x, y)
      const fw = fishWidthFor(width)
      const dx = Math.abs(n.x - frame.x)
      const dy = Math.abs(n.y - frame.y) / (width / height)
      if (dx < fw * 0.5 * frame.scale && dy < fw * 0.36 * frame.scale) {
        sim.flare()
      } else {
        sim.lookAt(n)
        ripple = { x: n.x, y: n.y, t0: elapsed }
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      sim.activity()
      const target = e.target as Element | null
      if (target?.closest?.(INTERACTIVE)) return
      const ex = live.current.exclusion
      if (
        ex &&
        e.clientX >= ex.left &&
        e.clientX <= ex.right &&
        e.clientY >= ex.top &&
        e.clientY <= ex.bottom
      )
        return
      handleTap(e.clientX, e.clientY)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      renderer?.setPointer((e.clientX / width) * 2 - 1, (e.clientY / height) * 2 - 1)
      if (isStatic()) return
    }
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return
      renderer?.setPointer(e.gamma / 30, (e.beta - 45) / 30)
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    const onKey = () => sim.activity()

    window.addEventListener('resize', resize)
    const resizeObserver = inSlot ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('keydown', onKey, { passive: true })
    window.addEventListener('deviceorientation', onOrientation, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    if (isStatic()) requestStatic()
    else start()

    // Keep loop state in sync when reduced motion / freeze flips at runtime.
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => {
      stop()
      if (isStatic()) requestStatic()
      else start()
    }
    mq?.addEventListener?.('change', onMotionChange)
    api.current.dirty = () => {
      if (isStatic()) {
        stop()
        requestStatic()
      } else if (!rafId) start()
    }

    return () => {
      disposed = true
      stop()
      api.current = null
      if (controlsRef) controlsRef.current = null
      offPellet()
      offTap()
      offFocus()
      offBlur()
      offActivity()
      window.removeEventListener('resize', resize)
      resizeObserver?.disconnect()
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('deviceorientation', onOrientation)
      document.removeEventListener('visibilitychange', onVisibility)
      mq?.removeEventListener?.('change', onMotionChange)
      renderer?.destroy()
      renderer = null
    }
    // Props are read through `live`; the loop is created once per mount (and per seed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, host])

  if (!supported || !host) return null
  const inSlot = host !== document.body
  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="tank-scene"
      style={{
        position: inSlot ? 'absolute' : 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: inSlot ? undefined : -1,
        pointerEvents: 'none',
        display: 'block',
      }}
    />,
    host,
  )
}
