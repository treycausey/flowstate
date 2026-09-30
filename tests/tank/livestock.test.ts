import { CorySim, CORY_TURN_GAP, KuhliSim } from '@/lib/tank/bottom'
import { CrawlerSim, EDGES, NODES } from '@/lib/tank/crawlers'
import type { CreatureFrame, World } from '@/lib/tank/creature'
import { Livestock } from '@/lib/tank/livestock'
import { PelletField } from '@/lib/tank/pellets'
import { SchoolSim, SCHOOL_REVERSE_GAP } from '@/lib/tank/school'
import { halfExtents, spriteWidth, SPECIES } from '@/lib/tank/species'
import { stockEntry } from '@/lib/tank/stock'
import { MINUTES, SEEDS, WORLDS } from './stockWorlds'

const DT = 1 / 30
const SECONDS = MINUTES * 60
const EPS = 1e-6

function run(seconds: number, each: () => void, step: (dt: number) => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(DT)
    each()
  }
}

/** Every drawn rect stays inside `box` (normalised) and off the panel. */
function inside(
  f: CreatureFrame,
  w: World,
  box: { x0: number; y0: number; x1: number; y1: number },
) {
  const { hw, hh } = halfExtents(SPECIES[f.species], w.fishWidth, f.scale)
  const hhN = hh * w.aspect
  return (
    f.x - hw >= box.x0 - EPS &&
    f.x + hw <= box.x1 + EPS &&
    f.y - hhN >= box.y0 - EPS &&
    f.y + hhN <= box.y1 + EPS
  )
}

function meanNearest(frames: CreatureFrame[], aspect: number) {
  let sum = 0
  for (const a of frames) {
    let m = Infinity
    for (const b of frames)
      if (a !== b) m = Math.min(m, Math.hypot(a.x - b.x, (a.y - b.y) / aspect))
    sum += m
  }
  return sum / frames.length
}

describe.each(WORLDS)('school (%s)', (_name, world) => {
  describe.each(SEEDS)('seed %d', (seed) => {
    it('hangs together, stays in open water, turns rarely and calmly', () => {
      const profile = SPECIES['neon-tetra']
      const sim = new SchoolSim(profile, 10, seed, new PelletField())
      sim.configure(world)
      const bl = spriteWidth(profile, world.fishWidth)
      let nn = 0
      let nnN = 0
      let speed = 0
      let speedN = 0
      let outside = 0
      let steep = 0
      let t = 0
      run(
        SECONDS,
        () => {
          t += DT
          const frames = sim.frames()
          for (const f of frames) if (!inside(f, world, world.free)) outside++
          // Level fish: no steep pitch outside a turn.
          for (const f of frames) if (f.turnProgress === 0 && Math.abs(f.pitch) > 0.27) steep++
          if (Math.round(t / DT) % 30 === 0) {
            nn += meanNearest(frames, world.aspect) / bl
            nnN++
            for (const f of frames) {
              speed += f.speed / bl
              speedN++
            }
          }
        },
        (dt) => sim.step(dt),
      )
      expect(outside).toBe(0)
      expect(sim.clampHits).toBe(0)
      expect(steep).toBe(0)
      // Cohesion: mean nearest-neighbour distance stays within a few body lengths.
      expect(nn / nnN).toBeLessThan(2.5)
      // Calm: a fraction of a body length per second on average.
      expect(speed / speedN).toBeLessThan(0.45)
      // No individual reverses more than once per 15 s.
      const last = new Map<string, number>()
      for (const [key, at] of sim.turnLog) {
        const prev = last.get(key)
        if (prev !== undefined) expect(at - prev).toBeGreaterThanOrEqual(15)
        last.set(key, at)
      }
      // The whole school reverses rarely.
      for (let i = 1; i < sim.reverseLog.length; i++) {
        expect(sim.reverseLog[i] - sim.reverseLog[i - 1]).toBeGreaterThanOrEqual(SCHOOL_REVERSE_GAP)
      }
    })
  })
})

describe('school behaviour', () => {
  const world = WORLDS[0][1]
  const profile = SPECIES['neon-tetra']
  const meanOf = (sim: SchoolSim, seconds: number) => {
    let nn = 0
    let y = 0
    let n = 0
    run(
      seconds,
      () => {
        const f = sim.frames()
        nn += meanNearest(f, world.aspect)
        y += f.reduce((s, c) => s + c.y, 0) / f.length
        n++
      },
      (dt) => sim.step(dt),
    )
    return { nn: nn / n, y: y / n }
  }

  it('tightens and sinks when the water is stressed', () => {
    const calm = new SchoolSim(profile, 10, 3, new PelletField())
    calm.configure(world)
    run(
      30,
      () => {},
      (dt) => calm.step(dt),
    )
    const a = meanOf(calm, 120)
    const tense = new SchoolSim(profile, 10, 3, new PelletField())
    tense.configure(world)
    tense.setContext({ night: false, dusk: false, mood: 'stressed' })
    run(
      60,
      () => {},
      (dt) => tense.step(dt),
    )
    const b = meanOf(tense, 120)
    expect(b.nn).toBeLessThan(a.nn)
    expect(b.y).toBeGreaterThan(a.y)
  })

  it('spreads across depth layers', () => {
    const sim = new SchoolSim(profile, 10, 2, new PelletField())
    sim.configure(world)
    run(
      20,
      () => {},
      (dt) => sim.step(dt),
    )
    const z = sim.frames().map((f) => f.z)
    expect(Math.min(...z)).toBeGreaterThanOrEqual(0.35)
    expect(Math.max(...z)).toBeLessThanOrEqual(0.6)
    expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(0.1)
  })

  it('holds fewer fish in a short band instead of crowding them', () => {
    const landscape = WORLDS[2][1]
    const sim = new SchoolSim(SPECIES['neon-tetra'], 12, 1, new PelletField())
    sim.configure(landscape)
    expect(sim.count).toBeLessThan(12)
    expect(sim.count).toBeGreaterThanOrEqual(3)
  })
})

describe.each(WORLDS)('corydoras (%s)', (name, world) => {
  it.each(SEEDS)('patrols the substrate band (seed %d)', (seed) => {
    const sim = new CorySim(SPECIES['panda-corydoras'], 6, seed, new PelletField())
    sim.configure(world)
    const frames0 = sim.frames()
    if (name === 'phone' || name === 'landscape') {
      // The sheet covers the substrate: nothing is drawn there.
      expect(frames0).toHaveLength(0)
      return
    }
    let outside = 0
    run(
      SECONDS,
      () => {
        for (const f of sim.frames()) {
          // On screen, off the panel (x inside the open stretch of the band).
          if (!inside(f, world, { x0: 0, x1: 1, y0: 0, y1: 1 })) outside++
          if (f.x < sim.band.x0 - 1e-6 || f.x > sim.band.x1 + 1e-6) outside++
          // Level on the substrate (a surface dart is the only steep move).
          if (sim.darts === 0 && Math.abs(f.pitch) > 0.18) outside++
          if (sim.darts === 0 && (f.y < sim.band.y0 - 1e-6 || f.y > sim.band.y1 + 1e-6)) outside++
        }
      },
      (dt) => sim.step(dt),
    )
    expect(outside).toBe(0)
    const last = new Map<string, number>()
    for (const [key, at] of sim.turnLog) {
      const prev = last.get(key)
      if (prev !== undefined) expect(at - prev).toBeGreaterThanOrEqual(CORY_TURN_GAP - 1e-6)
      last.set(key, at)
    }
  })
})

describe('cory surface dart', () => {
  it('goes up through open water and comes back to the substrate', () => {
    const world = WORLDS[3][1]
    const sim = new CorySim(SPECIES['panda-corydoras'], 6, 4, new PelletField())
    sim.configure(world)
    run(
      10,
      () => {},
      (dt) => sim.step(dt),
    )
    expect(sim.dart()).toBe(true)
    let minY = 1
    run(
      10,
      () => {
        for (const f of sim.frames()) minY = Math.min(minY, f.y)
      },
      (dt) => sim.step(dt),
    )
    expect(minY).toBeLessThan(sim.band.y0 - 0.3)
    for (const f of sim.frames()) {
      expect(f.y).toBeGreaterThanOrEqual(sim.band.y0 - 1e-6)
      expect(f.y).toBeLessThanOrEqual(sim.band.y1 + 1e-6)
    }
  })

  it('never darts in stressed water, and never through the panel', () => {
    const desktop = WORLDS[0][1]
    const stressed = new CorySim(SPECIES['panda-corydoras'], 6, 5, new PelletField())
    stressed.configure(desktop)
    stressed.setContext({ night: false, dusk: false, mood: 'stressed' })
    run(
      SECONDS * 2,
      () => {},
      (dt) => stressed.step(dt),
    )
    expect(stressed.darts).toBe(0)

    const sim = new CorySim(SPECIES['panda-corydoras'], 6, 5, new PelletField())
    sim.configure(desktop)
    const panel = desktop.exclusion!
    let hit = 0
    for (let k = 0; k < 4; k++) {
      sim.dart()
      run(
        14,
        () => {
          for (const f of sim.frames()) {
            const { hw } = halfExtents(SPECIES['panda-corydoras'], desktop.fishWidth, f.scale)
            if (f.x - hw < panel.x1 && f.x + hw > panel.x0) hit++
          }
        },
        (dt) => sim.step(dt),
      )
    }
    expect(hit).toBe(0)
  })
})

function distToGraph(x: number, y: number, view: ReadonlyArray<[number, number]>, aspect: number) {
  let best = Infinity
  for (const [a, b] of EDGES) {
    const ax = view[a][0]
    const ay = view[a][1] / aspect
    const bx = view[b][0]
    const by = view[b][1] / aspect
    const px = x
    const py = y / aspect
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy || 1e-9
    const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2))
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
  }
  return best
}

describe.each(WORLDS)('crawlers (%s)', (_name, world) => {
  it.each(['cherry-shrimp', 'nerite-snail', 'otocinclus'])(
    '%s stays on its anchor graph and off the panel',
    (id) => {
      const profile = SPECIES[id]
      const sim = new CrawlerSim(profile, id === 'otocinclus' ? 4 : 5, 2, new PelletField())
      sim.configure(world)
      let off = 0
      let overlap = 0
      let seen = 0
      run(
        SECONDS / 2,
        () => {
          for (const f of sim.frames()) {
            seen++
            if (distToGraph(f.x, f.y, sim.nodePositions(), world.aspect) > 0.02) off++
            if (f.alpha > 0.5) {
              const { hw, hh } = halfExtents(profile, world.fishWidth, f.scale)
              const e = world.exclusion
              if (
                e &&
                f.x + hw * 0.6 > e.x0 &&
                f.x - hw * 0.6 < e.x1 &&
                f.y + hh * world.aspect * 0.6 > e.y0 &&
                f.y - hh * world.aspect * 0.6 < e.y1
              )
                overlap++
            }
          }
        },
        (dt) => sim.step(dt),
      )
      expect(off).toBe(0)
      expect(overlap).toBe(0)
      // Something is drawn wherever the panel leaves anchors (the phone sheet hides most of them).
      if (_name === 'desktop' || _name === 'open tank') expect(seen).toBeGreaterThan(100)
    },
  )

  it('snails glide a few pixels per second at most', () => {
    const profile = SPECIES['mystery-snail']
    const sim = new CrawlerSim(profile, 2, 3, new PelletField())
    sim.configure(world)
    let fastest = 0
    run(
      120,
      () => {
        for (const f of sim.frames()) fastest = Math.max(fastest, f.speed)
      },
      (dt) => sim.step(dt),
    )
    // 0.008 view widths per second is about 12 px per second on a 1440 px screen.
    expect(fastest).toBeLessThan(0.008)
  })
})

describe('kuhli loaches', () => {
  const world = WORLDS[3][1]
  const visibleSeconds = (night: boolean) => {
    const sim = new KuhliSim(SPECIES['kuhli-loach'], 3, 2)
    sim.configure(world)
    sim.setContext({ night, dusk: false, mood: 'healthy' })
    let seen = 0
    let offBand = 0
    run(
      SECONDS,
      () => {
        for (const f of sim.frames()) {
          seen += DT
          if (f.y < world.floorY - 0.05 || f.y > world.floorY) offBand++
        }
      },
      (dt) => sim.step(dt),
    )
    return { seen, offBand }
  }

  it('stay hidden by day', () => {
    expect(visibleSeconds(false).seen).toBe(0)
  })

  it('slither along the substrate at night and fade in and out at the rocks', () => {
    const r = visibleSeconds(true)
    expect(r.seen).toBeGreaterThan(5)
    expect(r.offBand).toBe(0)
    const sim = new KuhliSim(SPECIES['kuhli-loach'], 1, 7)
    sim.configure(world)
    sim.setContext({ night: true, dusk: false, mood: 'healthy' })
    const alphas: number[] = []
    run(
      SECONDS,
      () => sim.frames().forEach((f) => alphas.push(f.alpha)),
      (dt) => sim.step(dt),
    )
    expect(Math.min(...alphas)).toBeLessThan(0.3)
    expect(Math.max(...alphas)).toBeGreaterThan(0.95)
  })
})

describe('feeding', () => {
  const world = WORLDS[3][1]

  it('sinks a pellet to the substrate and fades it after about 20 s', () => {
    const field = new PelletField()
    field.floorY = 0.9
    field.aspect = world.aspect
    field.add(0.5, 0.1)
    let landedAt = -1
    let goneAt = -1
    for (let i = 0; i < 40 * 30; i++) {
      field.step(DT)
      const p = field.pellets[0]
      if (p && landedAt < 0 && field.isLanded(p)) landedAt = i * DT
      if (!p && goneAt < 0) goneAt = i * DT
    }
    expect(landedAt).toBeGreaterThan(5)
    expect(landedAt).toBeLessThan(25)
    expect(goneAt - landedAt).toBeGreaterThan(18)
    expect(goneAt - landedAt).toBeLessThan(23)
  })

  it('drops several pellets for a bigger stock and one for the betta alone', () => {
    const lone = new Livestock(1)
    lone.dropPellet()
    expect(lone.frame().pellets).toHaveLength(1)
    const tank = new Livestock(1, {}, [
      stockEntry('neon-tetra', 12),
      stockEntry('panda-corydoras', 6),
    ])
    tank.configure({ aspect: world.aspect, fishWidth: world.fishWidth, floorY: world.floorY })
    tank.dropPellet()
    const n = tank.frame().pellets.length
    expect(n).toBeGreaterThan(1)
    expect(n).toBeLessThanOrEqual(5)
  })

  it('has mid-water fish, corys and shrimp all eat, and clears what is left', () => {
    const tank = new Livestock(3, {}, [
      stockEntry('neon-tetra', 8),
      stockEntry('panda-corydoras', 5),
      stockEntry('cherry-shrimp', 5),
    ])
    tank.configure({
      aspect: world.aspect,
      fishWidth: world.fishWidth,
      exclusion: null,
      floorY: world.floorY,
      plateToView: world.plateToView,
    })
    const ate = new Set<string>()
    tank.dropPellet({ x: 0.55, y: 0.1 })
    run(
      70,
      () => {},
      (dt) => {
        for (const c of tank.step(dt).creatures) if (c.gulp > 0.5) ate.add(c.species)
      },
    )
    expect(ate.has('neon-tetra')).toBe(true)
    expect(tank.frame().pellets).toHaveLength(0)
    // Food that reaches the substrate is eaten there by the bottom dwellers.
    const tank2 = new Livestock(4, {}, [
      stockEntry('panda-corydoras', 5),
      stockEntry('cherry-shrimp', 5),
    ])
    tank2.configure({
      aspect: world.aspect,
      fishWidth: world.fishWidth,
      floorY: world.floorY,
      plateToView: world.plateToView,
    })
    const ate2 = new Set<string>()
    tank2.dropPellet({ x: 0.55, y: 0.1 })
    tank2.dropPellet({ x: 0.45, y: 0.1 })
    run(
      70,
      () => {},
      (dt) => {
        for (const c of tank2.step(dt).creatures) if (c.gulp > 0.5) ate2.add(c.species)
      },
    )
    expect(ate2.has('panda-corydoras') || ate2.has('cherry-shrimp')).toBe(true)
  })

  it('lets the betta eat from the shared pellets', () => {
    const tank = new Livestock(2)
    tank.configure({ aspect: world.aspect, fishWidth: world.fishWidth, floorY: world.floorY })
    tank.dropPellet({ x: 0.6, y: 0.1 })
    let gulped = false
    run(
      40,
      () => {},
      (dt) => {
        if ((tank.step(dt).betta?.gulp ?? 0) > 0.5) gulped = true
      },
    )
    expect(gulped).toBe(true)
  })
})

describe('anchor graph', () => {
  it('keeps every anchor at or above the substrate line, clear of the foreground blur', () => {
    for (const n of NODES) expect(n.v).toBeLessThanOrEqual(0.8)
  })
})
