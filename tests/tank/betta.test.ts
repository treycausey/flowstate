import { BettaSim, type BettaFrame, type Rect } from '@/lib/tank/betta'

const DT = 1 / 30
const run = (sim: BettaSim, seconds: number, each?: (f: BettaFrame) => void) => {
  let f = sim.frame()
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    f = sim.step(DT)
    each?.(f)
  }
  return f
}
const dist = (f: BettaFrame, x: number, y: number, aspect = 1.6) =>
  Math.hypot(f.x - x, (f.y - y) / aspect)

const FPS60 = 1 / 60
type World = { fw: number; aspect: number; exclusion: Rect; free: Rect }
/** Desktop 1440x900: panel covers the left 33%. */
const DESKTOP: World = {
  fw: 0.19,
  aspect: 1.6,
  exclusion: { x0: 0.01, y0: 0.02, x1: 0.33, y1: 0.98 },
  free: { x0: 0.33, y0: 0.09, x1: 1, y1: 0.88 },
}
/** Phone 375x812: the sheet covers everything below 34% of the height. */
const PHONE: World = {
  fw: 0.34,
  aspect: 0.46,
  exclusion: { x0: 0, y0: 0.34, x1: 1, y1: 2 },
  free: { x0: 0, y0: 0.09, x1: 1, y1: 0.34 },
}
const SEEDS = [1, 2, 3, 4, 5]

type Metrics = {
  rectViolations: number
  turns: number
  minTurnGap: number
  hoverFrac: number
  meanSpeed: number
  maxSpeed: number
  maxAccel: number
  zMin: number
  zMax: number
  maxDz: number
  seconds: number
}

/** Run `wander` for `seconds` at 60 Hz and measure the motion from frame output alone. */
function measure(world: World, seed: number, seconds: number): Metrics {
  const sim = new BettaSim(seed, {
    aspect: world.aspect,
    fishWidth: world.fw,
    exclusion: world.exclusion,
  })
  const w = world.free.x1 - world.free.x0
  const inset = 0.04 * w
  const m: Metrics = {
    rectViolations: 0,
    turns: 0,
    minTurnGap: Infinity,
    hoverFrac: 0,
    meanSpeed: 0,
    maxSpeed: 0,
    maxAccel: 0,
    zMin: 1,
    zMax: 0,
    maxDz: 0,
    seconds,
  }
  let prev: BettaFrame | null = null
  let prevV: { x: number; y: number } | null = null
  let lastTurnAt = -Infinity
  let hover = 0
  let speedSum = 0
  const n = Math.round(seconds / FPS60)
  for (let i = 0; i < n; i++) {
    if (i % 60 === 0) sim.activity() // a watched tank: no idle inspect
    const f = sim.step(FPS60)
    const t = i * FPS60
    const hw = 0.5 * world.fw * f.scale
    const hh = 0.3 * world.fw * f.scale
    const eps = 1e-9
    if (
      f.x - hw < world.free.x0 + inset - eps ||
      f.x + hw > world.free.x1 - inset + eps ||
      f.y - hh * world.aspect < world.free.y0 + inset * world.aspect - eps ||
      f.y + hh * world.aspect > world.free.y1 - inset * world.aspect + eps
    )
      m.rectViolations++
    if (prev) {
      const v = { x: (f.x - prev.x) / FPS60, y: (f.y - prev.y) / world.aspect / FPS60 }
      const speed = Math.hypot(v.x, v.y)
      if (speed < 0.006) hover++
      speedSum += speed
      m.maxSpeed = Math.max(m.maxSpeed, speed)
      if (prevV) {
        const a = Math.hypot(v.x - prevV.x, v.y - prevV.y) / FPS60
        m.maxAccel = Math.max(m.maxAccel, a)
      }
      prevV = v
      m.maxDz = Math.max(m.maxDz, Math.abs(f.z - prev.z) / FPS60)
      if (f.heading !== prev.heading) {
        m.turns++
        m.minTurnGap = Math.min(m.minTurnGap, t - lastTurnAt)
        lastTurnAt = t
      }
    }
    m.zMin = Math.min(m.zMin, f.z)
    m.zMax = Math.max(m.zMax, f.z)
    prev = f
  }
  m.hoverFrac = hover / n
  m.meanSpeed = speedSum / n
  return m
}

describe.each([
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const)('BettaSim wander behaviour (%s, 10 min x 5 seeds)', (_name, world) => {
  const runs = SEEDS.map((seed) => measure(world, seed, 600))

  it('keeps the drawn rect inside the inset free rectangle and never hits the hard clamp', () => {
    for (const r of runs) expect(r.rectViolations).toBe(0)
    for (const seed of SEEDS) {
      const sim = new BettaSim(seed, {
        aspect: world.aspect,
        fishWidth: world.fw,
        exclusion: world.exclusion,
      })
      for (let i = 0; i < 600 * 60; i++) {
        if (i % 60 === 0) sim.activity()
        sim.step(FPS60)
      }
      expect(sim.clampHits).toBe(0)
    }
  })

  it('turns rarely: at most 3 per minute and never two within 9 s', () => {
    for (const r of runs) {
      expect(r.turns / (r.seconds / 60)).toBeLessThanOrEqual(3)
      expect(r.minTurnGap).toBeGreaterThanOrEqual(9)
    }
  })

  it('hovers most of the time and never darts', () => {
    for (const r of runs) {
      expect(r.hoverFrac).toBeGreaterThanOrEqual(0.55)
      expect(r.meanSpeed).toBeLessThanOrEqual(0.012)
      expect(r.maxSpeed).toBeLessThanOrEqual(0.046)
      expect(r.maxAccel).toBeLessThanOrEqual(0.03)
    }
  })

  it('drifts in depth slowly', () => {
    for (const r of runs) {
      expect(r.zMin).toBeGreaterThanOrEqual(0.2)
      expect(r.zMax).toBeLessThanOrEqual(0.7)
      expect(r.maxDz).toBeLessThanOrEqual(0.05)
    }
  })
})

describe('BettaSim placement', () => {
  it('approach stops at least 0.6 fish widths from the panel edge, slowly, facing it', () => {
    const sim = new BettaSim(2, { ...DESKTOP, exclusion: DESKTOP.exclusion, aspect: 1.6 })
    sim.focusAt({ x: 0.3, y: 0.4 })
    let maxSpeed = 0
    let f = sim.frame()
    for (let i = 0; i < 60 * 60; i++) {
      f = sim.step(FPS60)
      maxSpeed = Math.max(maxSpeed, f.speed)
    }
    expect(f.mode).toBe('approach')
    expect(f.x - DESKTOP.exclusion.x1).toBeGreaterThanOrEqual(0.6 * DESKTOP.fw)
    expect(f.heading).toBe(-1)
    expect(maxSpeed).toBeLessThanOrEqual(0.045)
  })

  it('shrinks the fish in a narrow free rectangle instead of clipping it', () => {
    const narrow: World = {
      fw: 0.19,
      aspect: 1.6,
      exclusion: { x0: 0, y0: 0, x1: 0.8, y1: 1 },
      free: { x0: 0.8, y0: 0.09, x1: 1, y1: 0.88 },
    }
    const r = measure(narrow, 3, 120)
    expect(r.rectViolations).toBe(0)
    const sim = new BettaSim(3, {
      aspect: narrow.aspect,
      fishWidth: narrow.fw,
      exclusion: narrow.exclusion,
    })
    let maxScale = 0
    for (let i = 0; i < 120 * 60; i++) maxScale = Math.max(maxScale, sim.step(FPS60).scale)
    expect(maxScale).toBeLessThan(0.75)
    const wide = new BettaSim(3, { aspect: 1.6, fishWidth: 0.19, exclusion: DESKTOP.exclusion })
    let wideMax = 0
    for (let i = 0; i < 120 * 60; i++) wideMax = Math.max(wideMax, wide.step(FPS60).scale)
    expect(wideMax).toBeGreaterThan(1)
  })
})

describe('BettaSim', () => {
  it('wanders inside the bounds and out of the exclusion zone for 10k steps', () => {
    const exclusion = { x0: 0.03, y0: 0.03, x1: 0.29, y1: 0.97 }
    const sim = new BettaSim(7, { exclusion })
    const b = sim.bounds()
    let maxSpeed = 0
    let minX = 1
    run(sim, 10_000 * DT, (f) => {
      expect(f.x).toBeGreaterThanOrEqual(b.x0 - 1e-9)
      expect(f.x).toBeLessThanOrEqual(b.x1 + 1e-9)
      expect(f.y).toBeGreaterThanOrEqual(b.y0 - 1e-9)
      expect(f.y).toBeLessThanOrEqual(b.y1 + 1e-9)
      expect(f.x).toBeGreaterThan(exclusion.x1)
      maxSpeed = Math.max(maxSpeed, f.speed)
      minX = Math.min(minX, f.x)
    })
    expect(maxSpeed).toBeLessThan(0.07)
    expect(maxSpeed).toBeGreaterThan(0.02)
  })

  it('is deterministic for a seed', () => {
    const a = new BettaSim(3)
    const b = new BettaSim(3)
    const fa = run(a, 20)
    const fb = run(b, 20)
    expect(fa.x).toBe(fb.x)
    expect(fa.y).toBe(fb.y)
    expect(fa.tailBeatPhase).toBe(fb.tailBeatPhase)
  })

  it('approaches a focus point, stops about a body length away, and faces it', () => {
    const fw = 0.19
    const sim = new BettaSim(2, { fishWidth: fw })
    const point = { x: 0.3, y: 0.4 }
    sim.focusAt(point)
    const f = run(sim, 40)
    expect(f.mode).toBe('approach')
    const d = Math.hypot(f.x - point.x, (f.y - point.y) / 1.6)
    expect(d).toBeGreaterThan(fw * 0.6)
    expect(d).toBeLessThan(fw * 1.1)
    expect(f.speed).toBeLessThan(0.01)
    expect(f.heading).toBe(f.x > point.x ? -1 : 1)
  })

  it('chases a pellet, gulps it, then hovers before carrying on', () => {
    const sim = new BettaSim(5)
    sim.dropPellet({ x: 0.5, y: 0.1 })
    let reached = false
    let sawChase = false
    run(sim, 30, (f) => {
      if (f.mode === 'chase') sawChase = true
      if (sawChase && f.pellets.length === 0) reached = true
    })
    expect(sawChase).toBe(true)
    expect(reached).toBe(true)
  })

  it('flares for 1.5 to 2.5 seconds, using the flare pose', () => {
    const sim = new BettaSim(9)
    run(sim, 2)
    sim.flare()
    let flareFrames = 0
    let peak = 0
    run(sim, 6, (f) => {
      if (f.mode === 'flare') flareFrames++
      peak = Math.max(peak, f.pose.flare)
    })
    expect(flareFrames * DT).toBeGreaterThanOrEqual(1.4)
    expect(flareFrames * DT).toBeLessThanOrEqual(2.6)
    expect(peak).toBeGreaterThan(0.9)
  })

  it('sulks low, slowly, in the clamped pose when stressed', () => {
    const sim = new BettaSim(11)
    sim.setContext({ night: false, mood: 'stressed' })
    const b = sim.bounds()
    let maxSpeed = 0
    const f = run(sim, 60, (fr) => {
      maxSpeed = Math.max(maxSpeed, fr.speed)
    })
    expect(f.mode).toBe('sulk')
    expect(f.y).toBeGreaterThan(b.y1 - 0.08)
    expect(f.pose.clamped).toBeGreaterThan(0.9)
    expect(maxSpeed).toBeLessThan(0.025)
    expect(f.finSpread).toBeLessThan(0.3)
  })

  it('rests at the leaf spot at night, barely moving', () => {
    const rest = { x: 0.74, y: 0.3 }
    const sim = new BettaSim(13, { restSpot: rest })
    sim.setContext({ night: true, mood: 'healthy' })
    const f = run(sim, 90)
    expect(f.mode).toBe('rest')
    const p = sim.project(rest.x, rest.y)
    expect(dist(f, p.x, p.y)).toBeLessThan(0.05)
    expect(f.speed).toBeLessThan(0.005)
  })

  it('turns around when the target lies behind it', () => {
    const sim = new BettaSim(4)
    run(sim, 3)
    const f0 = sim.frame()
    // Focus behind the fish's current heading, far enough to force a reversal.
    const behind = f0.heading === 1 ? { x: 0.3, y: f0.y } : { x: 0.95, y: f0.y }
    sim.focusAt(behind)
    let turned = false
    let sawProgress = false
    let flippedFacing = false
    run(sim, 12, (f) => {
      if (f.heading !== f0.heading) turned = true
      if (f.turnProgress > 0.1 && f.turnProgress < 0.9) sawProgress = true
      if (f.facing !== f0.facing) flippedFacing = true
    })
    expect(turned).toBe(true)
    expect(sawProgress).toBe(true)
    expect(flippedFacing).toBe(true)
  })

  it('swims to the camera after two idle minutes, then leaves', () => {
    const sim = new BettaSim(21)
    let maxZ = 0
    let sawStare = false
    run(sim, 150, (f) => {
      maxZ = Math.max(maxZ, f.z)
      if (f.viewerFacing > 0.8) sawStare = true
    })
    expect(maxZ).toBeGreaterThan(0.75)
    expect(sawStare).toBe(true)
    const f = run(sim, 20)
    expect(f.z).toBeLessThan(0.6)
  })

  it('does not inspect while the user is active', () => {
    const sim = new BettaSim(21)
    let maxZ = 0
    for (let s = 0; s < 400; s++) {
      if (s % 30 === 0) sim.activity()
      const f = run(sim, 1)
      maxZ = Math.max(maxZ, f.z)
    }
    expect(maxZ).toBeLessThan(0.7)
  })

  it('celebrates with a full loop: the sprite pitches through a whole turn and ends level', () => {
    const sim = new BettaSim(3, { aspect: 1.6, fishWidth: 0.3 })
    run(sim, 2)
    const before = sim.frame()
    sim.celebrate()
    let maxPitch = 0
    let sawFlare = false
    run(sim, 1.0, (f) => {
      maxPitch = Math.max(maxPitch, f.pitch)
      sawFlare ||= f.mode === 'flare'
    })
    expect(sawFlare).toBe(true)
    expect(maxPitch).toBeGreaterThan(Math.PI * 1.5)
    const after = run(sim, 0.5)
    expect(Math.abs(after.pitch)).toBeLessThan(0.3)
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.2)
  })

  it('drops a pellet just ahead of the fish when no spot is given', () => {
    const sim = new BettaSim(5, { aspect: 1.6, fishWidth: 0.3 })
    const f = run(sim, 3)
    sim.dropPellet()
    const p = sim.frame().pellets[0]
    expect(Math.abs(p.x - f.x)).toBeLessThan(0.3)
  })
})
