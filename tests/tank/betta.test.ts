import { BettaSim, type BettaFrame } from '@/lib/tank/betta'

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
    const sim = new BettaSim(2)
    const fw = 0.3
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
