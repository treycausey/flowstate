import { CrawlerSim } from '@/lib/tank/crawlers'
import type { CreatureFrame } from '@/lib/tank/creature'
import { Livestock } from '@/lib/tank/livestock'
import { PelletField } from '@/lib/tank/pellets'
import { SchoolSim } from '@/lib/tank/school'
import { CorySim, KuhliSim } from '@/lib/tank/bottom'
import { halfExtents, SPECIES } from '@/lib/tank/species'
import { stockEntry } from '@/lib/tank/stock'
import { makeWorld, WORLDS } from './stockWorlds'

const DT = 1 / 30
const run = (seconds: number, step: (dt: number) => void) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(DT)
}
const open = WORLDS[3][1]
const covered = makeWorld({
  fw: 0.19,
  aspect: 1.6,
  exclusion: { x0: 0, y0: 0, x1: 1, y1: 1 },
})
const live = (l: Livestock, world = open) =>
  l.configure({
    aspect: world.aspect,
    fishWidth: world.fishWidth,
    exclusion: world.exclusion,
    floorY: world.floorY,
    plateToView: world.plateToView,
  })

describe('crawlers', () => {
  it('come back when the panel that covered every anchor goes away', () => {
    const sim = new CrawlerSim(SPECIES['cherry-shrimp'], 4, 2, new PelletField())
    sim.configure(covered)
    run(5, (dt) => sim.step(dt))
    expect(sim.frames()).toHaveLength(0)
    sim.configure(open)
    run(6, (dt) => sim.step(dt))
    expect(sim.frames().length).toBeGreaterThan(0)
  })

  it('eat a pellet only when they are at it, not at a node on the way', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const field = new PelletField()
      field.floorY = open.floorY
      field.aspect = open.aspect
      const sim = new CrawlerSim(SPECIES['cherry-shrimp'], 5, seed, field)
      sim.configure(open)
      run(2, (dt) => sim.step(dt))
      // A landed pellet at the far right of the carpet.
      const target = open.plateToView(0.92, 0.8)
      field.add(target[0], open.floorY - 0.001)
      field.step(DT)
      const p = field.pellets[0]
      let eatenAt = -1
      let nearest = Infinity
      for (let i = 0; i < 60 * 30 && eatenAt < 0; i++) {
        const before = field.pellets.length
        sim.step(DT)
        if (field.pellets.length < before) {
          eatenAt = i
          for (const f of sim.frames()) {
            nearest = Math.min(nearest, Math.hypot(f.x - p.x, (f.y - p.y) / open.aspect))
          }
        }
      }
      if (eatenAt >= 0) expect(nearest).toBeLessThan(0.1)
    }
  })
})

describe('school feeding', () => {
  it('lets go of a pellet that has sunk below its band', () => {
    const field = new PelletField()
    field.floorY = open.floorY
    field.aspect = open.aspect
    // A school in the top third of the open water only.
    const sim = new SchoolSim(SPECIES['neon-tetra'], 8, 3, field, [0, 0.33])
    sim.configure(open)
    run(10, (dt) => sim.step(dt))
    const box = sim.box()
    field.add((box.x0 + box.x1) / 2, (box.y1 + 0.2) * open.aspect)
    const fish = (sim as unknown as { fish: Array<{ food: unknown }> }).fish
    fish[0].food = field.pellets[0]
    sim.step(DT)
    expect(fish.filter((f) => f.food)).toHaveLength(0)
  })

  it('lets go of a pellet once it has landed', () => {
    const field = new PelletField()
    field.floorY = open.floorY
    field.aspect = open.aspect
    const sim = new SchoolSim(SPECIES['neon-tetra'], 8, 3, field)
    sim.configure(open)
    run(10, (dt) => sim.step(dt))
    const box = sim.box()
    field.add((box.x0 + box.x1) / 2, open.floorY - 0.0001)
    field.step(DT)
    const fish = (sim as unknown as { fish: Array<{ food: unknown }> }).fish
    fish[0].food = field.pellets[0]
    sim.step(DT)
    expect(fish.filter((f) => f.food)).toHaveLength(0)
  })
})

describe('lanes and budget', () => {
  const lanes = (l: Livestock) =>
    l
      .groupsForTest()
      .filter((g) => g instanceof SchoolSim)
      .map((g) => [g.profile.id, (g as unknown as { lane: [number, number] }).lane])

  it('re-deals the lanes when a school is added and removed', () => {
    const l = new Livestock(1, {}, [stockEntry('neon-tetra', 8)])
    live(l)
    expect(lanes(l)).toEqual([['neon-tetra', [0, 1]]])
    l.setStock([stockEntry('neon-tetra', 8), stockEntry('chili-rasbora', 8)])
    const two = lanes(l).map((x) => x[1] as [number, number])
    expect(two).toHaveLength(2)
    expect(two[0][1]).toBeLessThanOrEqual(two[1][0] + 1e-9)
    l.setStock([stockEntry('chili-rasbora', 8)])
    expect(lanes(l)).toEqual([['chili-rasbora', [0, 1]]])
  })

  it('keeps creatures where they are when the frame budget changes', () => {
    const l = new Livestock(2, {}, [stockEntry('neon-tetra', 12), stockEntry('panda-corydoras', 6)])
    live(l)
    run(20, (dt) => l.step(dt))
    const pos = (frames: CreatureFrame[]) => new Map(frames.map((f) => [f.key, [f.x, f.y]]))
    const jump = (a: Map<string, number[]>, b: Map<string, number[]>) => {
      let worst = 0
      for (const [k, v] of b) {
        const u = a.get(k)
        if (u) worst = Math.max(worst, Math.hypot(u[0] - v[0], u[1] - v[1]))
      }
      return worst
    }
    for (const cap of [15, 32, 15, 32]) {
      const before = pos(l.frame().creatures)
      l.setBudget(cap)
      const after = pos(l.step(DT).creatures)
      expect(jump(before, after)).toBeLessThan(0.02)
      expect(after.size).toBeGreaterThan(0)
    }
  })
})

describe('betta-only pellets match the old behaviour', () => {
  it('stop within reach and are gone 8 s after landing', () => {
    const l = new Livestock(3)
    live(l)
    const reachY = l.betta!.bounds().y1 + 0.02 * open.aspect
    for (let k = 0; k < 8; k++) l.dropPellet({ x: 0.3 + 0.08 * k, y: 0.1 })
    expect(l.frame().pellets.length).toBeLessThanOrEqual(6)
    let maxY = 0
    let worstRest = 0
    const rest = new Map<number, number>()
    run(40, (dt) => {
      const f = l.step(dt)
      for (const p of f.pellets) {
        maxY = Math.max(maxY, p.y)
        if (p.landed !== undefined) rest.set(p.id, Math.max(rest.get(p.id) ?? 0, p.landed))
      }
    })
    for (const v of rest.values()) worstRest = Math.max(worstRest, v)
    expect(maxY).toBeLessThanOrEqual(reachY)
    expect(worstRest).toBeLessThanOrEqual(8.1)
    expect(l.frame().pellets).toHaveLength(0)
  })
})

describe('pellets and hidden creatures', () => {
  it('do not get eaten by a group the panel hides', () => {
    const field = new PelletField()
    field.floorY = covered.floorY
    field.aspect = covered.aspect
    const sim = new CrawlerSim(SPECIES['cherry-shrimp'], 4, 1, field)
    sim.configure(covered)
    field.add(0.5, covered.floorY - 0.001)
    field.step(DT)
    run(12, (dt) => {
      field.step(dt)
      sim.step(dt)
    })
    expect(field.pellets.length).toBeGreaterThan(0)
  })
})

describe('crawlers when the panel takes every anchor while they walk', () => {
  it('keep stepping without error and return afterwards', () => {
    const sim = new CrawlerSim(SPECIES['cherry-shrimp'], 5, 3, new PelletField())
    sim.configure(open)
    run(20, (dt) => sim.step(dt))
    sim.configure(covered)
    expect(() => run(10, (dt) => sim.step(dt))).not.toThrow()
    expect(sim.frames()).toHaveLength(0)
    sim.configure(open)
    run(6, (dt) => sim.step(dt))
    expect(sim.frames().length).toBeGreaterThan(0)
  })
})

describe('kuhli', () => {
  it('pulls an in-progress path into a smaller free area', () => {
    const sim = new KuhliSim(SPECIES['kuhli-loach'], 1, 7)
    sim.configure(open)
    sim.setContext({ night: true, dusk: false, mood: 'healthy' })
    const loach = (
      sim as unknown as {
        loaches: Array<{ mode: string; sx: number; ex: number; x: number; t: number; dur: number }>
      }
    ).loaches[0]
    Object.assign(loach, { mode: 'go', sx: 0.05, ex: 0.2, x: 0.1, t: 1, dur: 10 })
    const desktop = WORLDS[0][1]
    sim.configure(desktop)
    sim.step(DT)
    const after = sim.frames()
    expect(after.length).toBeGreaterThan(0)
    for (const f of after) expect(f.x).toBeGreaterThanOrEqual(desktop.exclusion!.x1 - 1e-6)
  })
})

describe('crawler heading for a node that gets blocked', () => {
  it('fades out instead of walking on into the panel', () => {
    const sim = new CrawlerSim(SPECIES['cherry-shrimp'], 5, 3, new PelletField())
    sim.configure(open)
    type W = { mode: string; to: number }
    const walkers = (sim as unknown as { walkers: W[] }).walkers
    let w: W | undefined
    for (let i = 0; i < 120 * 30 && !w; i++) {
      sim.step(DT)
      w = walkers.find((x) => x.mode === 'walk')
    }
    expect(w).toBeDefined()
    const [tx, ty] = sim.nodePositions()[w!.to]
    const blocking = makeWorld({
      fw: 0.19,
      aspect: 1.6,
      exclusion: { x0: tx - 0.04, y0: ty - 0.06, x1: tx + 0.04, y1: ty + 0.06 },
    })
    sim.configure(blocking)
    expect(w!.mode).toBe('fade')
  })
})

describe('school and betta', () => {
  const desktop = WORLDS[0][1]
  it('keeps the school off the betta unless they are at clearly different depths', () => {
    for (const seed of [1, 2]) {
      const l = new Livestock(seed, {}, [stockEntry('betta', 1), stockEntry('neon-tetra', 10)])
      live(l, desktop)
      let samples = 0
      let overlaps = 0
      let t = 0
      run(240, (dt) => {
        const f = l.step(dt)
        t += dt
        if (!f.betta || Math.round(t / dt) % 15 !== 0) return
        const bw = desktop.fishWidth * f.betta.scale
        const rx = 0.5 * bw
        const ry = 0.34 * bw
        for (const c of f.creatures) {
          const { hw, hh } = halfExtents(SPECIES[c.species], desktop.fishWidth, c.scale)
          // Body rect a little inside the padded quad.
          const w = hw * 0.8
          const h = hh * 0.7
          const nx = Math.max(f.betta.x - rx, Math.min(c.x, f.betta.x + rx))
          const ny = Math.max(
            f.betta.y / desktop.aspect - ry,
            Math.min(c.y / desktop.aspect, f.betta.y / desktop.aspect + ry),
          )
          const inside =
            ((nx - c.x) / w) ** 2 + ((ny - c.y / desktop.aspect) / (h / 1)) ** 2 < 1 &&
            Math.hypot(
              (c.x - f.betta.x) / rx,
              (c.y / desktop.aspect - f.betta.y / desktop.aspect) / ry,
            ) < 1.2
          samples++
          if (inside && Math.abs(c.z - f.betta.z) < 0.1) overlaps++
        }
      })
      expect(samples).toBeGreaterThan(100)
      expect(overlaps / samples).toBeLessThan(0.02)
    }
  })
})

describe('corydoras do not stand in a stamped row', () => {
  it('cluster unevenly, differ in size and depth, and do not all face one way', () => {
    const world = WORLDS[3][1]
    for (const seed of [1, 2, 3]) {
      const sim = new CorySim(SPECIES['panda-corydoras'], 6, seed, new PelletField())
      sim.configure(world)
      let cvSum = 0
      let samples = 0
      let allSame = 0
      let t = 0
      const scales: number[] = []
      run(300, (dt) => {
        sim.step(dt)
        t += dt
        if (Math.round(t / dt) % 300 !== 0 || t < 30) return
        const f = sim.frames()
        const xs = f.map((c) => c.x).sort((a, b) => a - b)
        const gaps = xs.slice(1).map((x, i) => x - xs[i])
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
        const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length)
        cvSum += sd / mean
        samples++
        if (new Set(f.map((c) => c.heading)).size === 1) allSame++
        scales.push(...f.map((c) => c.scale))
      })
      expect(samples).toBeGreaterThan(10)
      expect(cvSum / samples).toBeGreaterThan(0.35)
      expect(allSame / samples).toBeLessThan(0.6)
      expect(Math.max(...scales) / Math.min(...scales)).toBeGreaterThan(1.15)
    }
  })
})

describe('betta push keeps the fish moving sideways', () => {
  type F = { x: number; y: number; z: number; vx: number; vy: number }
  it('removes only the speed towards the betta', () => {
    const world = WORLDS[3][1]
    const sim = new SchoolSim(SPECIES['neon-tetra'], 6, 2, new PelletField())
    sim.configure(world)
    run(20, (dt) => sim.step(dt))
    const f = (sim as unknown as { fish: F[] }).fish[0]
    f.vx = 0
    f.vy = 0.02
    // A betta just to the right and a hair above: the push is almost purely leftwards.
    sim.setAvoid({ x: f.x + 0.02, y: f.y + 0.001, rx: 0.05, ry: 0.03, z: f.z })
    const before = { x: f.x, vy: f.vy }
    sim.step(DT)
    expect(f.x).toBeLessThan(before.x + 1e-9)
    expect(f.vy).toBeGreaterThan(0.012)
  })

  it('never counts a betta push as hitting the edge of the water', () => {
    const world = WORLDS[0][1]
    const l = new Livestock(3, {}, [stockEntry('betta', 1), stockEntry('neon-tetra', 10)])
    live(l, world)
    run(240, (dt) => l.step(dt))
    const hits = l
      .groupsForTest()
      .filter((g): g is SchoolSim => g instanceof SchoolSim)
      .reduce((n, g) => n + g.clampHits, 0)
    expect(hits).toBe(0)
  })
})

describe('corydoras layout', () => {
  it('keeps its clusters when configured again', () => {
    const sim = new CorySim(SPECIES['panda-corydoras'], 6, 4, new PelletField())
    sim.configure(open)
    const before = JSON.stringify((sim as unknown as { offs: number[] }).offs)
    sim.configure(open)
    sim.configure(WORLDS[0][1])
    expect(JSON.stringify((sim as unknown as { offs: number[] }).offs)).toBe(before)
    sim.setVisible(4)
    expect(JSON.stringify((sim as unknown as { offs: number[] }).offs)).not.toBe(before)
  })
})

describe('stock changes keep the sims', () => {
  it('keeps every group and the betta when the same species come back with other counts', () => {
    const l = new Livestock(1, {}, [
      stockEntry('betta', 1),
      stockEntry('neon-tetra', 8),
      stockEntry('panda-corydoras', 4),
    ])
    live(l)
    const before = [...l.groupsForTest()]
    const betta = l.betta
    l.setStock([
      stockEntry('betta', 1),
      stockEntry('neon-tetra', 8),
      stockEntry('panda-corydoras', 4),
    ])
    expect(l.groupsForTest()).toEqual(before)
    l.setStock([
      stockEntry('betta', 1),
      stockEntry('neon-tetra', 6),
      stockEntry('panda-corydoras', 5),
    ])
    expect(l.groupsForTest().map((g) => g.profile.id)).toEqual(before.map((g) => g.profile.id))
    l.groupsForTest().forEach((g, i) => expect(g).toBe(before[i]))
    expect(l.betta).toBe(betta)
  })
})
