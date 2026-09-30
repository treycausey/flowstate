// Creatures that live on the aquascape itself: shrimp and snails on the moss, rocks and substrate, and
// otocinclus clinging to driftwood, leaves and glass. They walk a graph of anchor points placed on the
// plate (plate uv), so they move with the plate's parallax and never leave the surfaces. Pure and
// deterministic: seeded RNG, injected dt.

import { mulberry32 as mulberry } from './betta'
import type { Pellet, PelletField } from './pellets'
import { halfExtents, spriteWidth, type SpeciesProfile } from './species'
import {
  approach,
  clamp,
  lerp,
  overlapsPanel,
  sign,
  smooth,
  TAU,
  type CreatureFrame,
  type Group,
  type StockContext,
  type World,
} from './creature'

export type AnchorKind = 'ground' | 'moss' | 'wood' | 'leaf' | 'glass'
export type AnchorNode = { u: number; v: number; kind: AnchorKind }

/** Anchor points on the plate (plate uv), read off the aquascape: carpet, moss-covered rocks, driftwood. */
export const NODES: readonly AnchorNode[] = [
  // 0-9: the carpet along the front.
  { u: 0.06, v: 0.9, kind: 'ground' },
  { u: 0.17, v: 0.87, kind: 'ground' },
  { u: 0.27, v: 0.85, kind: 'ground' },
  { u: 0.37, v: 0.88, kind: 'ground' },
  { u: 0.46, v: 0.89, kind: 'ground' },
  { u: 0.55, v: 0.9, kind: 'ground' },
  { u: 0.64, v: 0.87, kind: 'ground' },
  { u: 0.73, v: 0.87, kind: 'ground' },
  { u: 0.82, v: 0.86, kind: 'ground' },
  { u: 0.92, v: 0.87, kind: 'ground' },
  // 10-19: moss and rock.
  { u: 0.17, v: 0.6, kind: 'moss' },
  { u: 0.25, v: 0.57, kind: 'moss' },
  { u: 0.33, v: 0.64, kind: 'moss' },
  { u: 0.22, v: 0.7, kind: 'moss' },
  { u: 0.47, v: 0.5, kind: 'moss' },
  { u: 0.51, v: 0.6, kind: 'moss' },
  { u: 0.56, v: 0.72, kind: 'moss' },
  { u: 0.66, v: 0.68, kind: 'moss' },
  { u: 0.71, v: 0.6, kind: 'moss' },
  { u: 0.5, v: 0.42, kind: 'moss' },
  // 20-24: driftwood.
  { u: 0.8, v: 0.44, kind: 'wood' },
  { u: 0.86, v: 0.5, kind: 'wood' },
  { u: 0.92, v: 0.56, kind: 'wood' },
  { u: 0.97, v: 0.6, kind: 'wood' },
  { u: 0.75, v: 0.4, kind: 'wood' },
  // 25-28: a broad leaf and the glass.
  { u: 0.085, v: 0.64, kind: 'leaf' },
  { u: 0.05, v: 0.73, kind: 'leaf' },
  { u: 0.02, v: 0.5, kind: 'glass' },
  { u: 0.02, v: 0.7, kind: 'glass' },
]

/** Snails rest on the carpet and on top edges (rock tops, the driftwood), never on steep faces. */
export const SNAIL_NODES: ReadonlySet<number> = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 21, 22, 23,
])

export const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [8, 9],
  [1, 13],
  [13, 10],
  [10, 11],
  [11, 12],
  [12, 3],
  [5, 16],
  [16, 15],
  [15, 14],
  [14, 19],
  [16, 17],
  [17, 18],
  [20, 21],
  [21, 22],
  [22, 23],
  [20, 24],
  [6, 17],
  [0, 26],
  [26, 25],
  [25, 10],
  [26, 28],
  [28, 27],
]

const STEP = 1 / 30
const GULP_SECONDS = 0.4
type Mode = 'rest' | 'turn' | 'walk' | 'eat' | 'fade'

type Walker = {
  key: string
  node: number
  /** Edge being walked: from `node` to `to`. */
  to: number
  s: number
  mode: Mode
  timer: number
  speedK: number
  hop: boolean
  heading: 1 | -1
  facing: 1 | -1
  turnT: number
  turnDur: number
  x: number
  y: number
  v: number
  pitch: number
  alpha: number
  phase: number
  leg: number
  gulpT: number
  path: number[]
  food: Pellet | null
  walked: number
  speed: number
}

export class CrawlerSim implements Group {
  readonly profile: SpeciesProfile
  private world!: World
  private ctx: StockContext = { night: false, dusk: false, mood: 'healthy' }
  private rng: () => number
  private walkers: Walker[] = []
  private visible: number
  private acc = 0
  private time = 0
  private view: Array<[number, number]> = []
  private blocked: boolean[] = []
  private adj: number[][] = []
  private allowedKinds: Set<AnchorKind>

  constructor(
    profile: SpeciesProfile,
    count: number,
    seed: number,
    private pellets: PelletField,
  ) {
    this.profile = profile
    this.rng = mulberry(seed)
    this.visible = count
    this.allowedKinds = new Set<AnchorKind>(
      profile.model === 'grazer'
        ? ['wood', 'leaf', 'glass']
        : profile.kind === 'snail'
          ? ['ground', 'moss', 'wood']
          : ['ground', 'moss', 'wood', 'leaf'],
    )
    for (let i = 0; i < count; i++) {
      this.walkers.push({
        key: `${profile.id}-${i}`,
        node: -1,
        to: -1,
        s: 0,
        mode: 'rest',
        timer: 1 + this.rng() * 6,
        speedK: 0.85 + this.rng() * 0.3,
        hop: false,
        heading: this.rng() < 0.5 ? 1 : -1,
        facing: 1,
        turnT: -1,
        turnDur: 0.6,
        x: 0,
        y: 0,
        v: 0.5,
        pitch: 0,
        alpha: 1,
        phase: this.rng() * TAU,
        leg: 0,
        gulpT: -1,
        path: [],
        food: null,
        walked: 0,
        speed: 0,
      })
      this.walkers[i].facing = this.walkers[i].heading
    }
  }

  private get bl() {
    return spriteWidth(this.profile, this.world.fishWidth)
  }

  private allowed(n: number) {
    if (this.profile.kind === 'snail' && !SNAIL_NODES.has(n)) return false
    return !this.blocked[n] && this.allowedKinds.has(NODES[n].kind)
  }

  configure(world: World) {
    const first = !this.world
    this.world = world
    this.view = NODES.map((n) => world.plateToView(n.u, n.v))
    const { hw, hh } = halfExtents(this.profile, world.fishWidth, 1.05)
    const pad = 0.012
    this.blocked = this.view.map(([x, y]) => {
      const inView = x > hw && x < 1 - hw && y > hh * world.aspect && y < 1 - hh * world.aspect
      return !inView || overlapsPanel(world, x, y, hw + pad, (hh + pad) * world.aspect)
    })
    this.adj = NODES.map(() => [])
    for (const [a, b] of EDGES) {
      if (this.edgeOk(a, b)) {
        this.adj[a].push(b)
        this.adj[b].push(a)
      }
    }
    for (const w of this.walkers) {
      if (first) this.place(w)
      else if (w.node >= 0 && !this.allowed(w.node)) w.mode = 'fade'
    }
  }

  private edgeOk(a: number, b: number) {
    if (!this.allowed(a) || !this.allowed(b)) return false
    const [ax, ay] = this.view[a]
    const [bx, by] = this.view[b]
    const { hw, hh } = halfExtents(this.profile, this.world.fishWidth, 1.05)
    return !overlapsPanel(
      this.world,
      (ax + bx) / 2,
      (ay + by) / 2,
      hw + 0.012,
      (hh + 0.012) * this.world.aspect,
    )
  }

  private place(w: Walker) {
    const taken = new Set(this.walkers.filter((o) => o !== w && o.node >= 0).map((o) => o.node))
    const pool = NODES.map((_, i) => i).filter((i) => this.allowed(i) && this.adj[i].length > 0)
    const free = pool.filter((i) => !taken.has(i))
    const list = free.length > 0 ? free : pool
    if (list.length === 0) {
      w.node = -1
      return
    }
    w.node = list[Math.floor(this.rng() * list.length)]
    w.to = -1
    w.s = 0
    w.mode = 'rest'
    w.timer = 1 + this.rng() * 8
    w.path = []
    w.food = null
    this.setPos(w)
  }

  private setPos(w: Walker) {
    const a = this.view[w.node]
    if (w.to < 0) {
      w.x = a[0]
      w.y = a[1]
      w.v = NODES[w.node].v
      return
    }
    const b = this.view[w.to]
    const k = w.hop ? smooth(w.s) : w.s
    w.x = lerp(a[0], b[0], k)
    w.y = lerp(a[1], b[1], k)
    w.v = lerp(NODES[w.node].v, NODES[w.to].v, k)
  }

  setContext(ctx: StockContext) {
    this.ctx = ctx
  }

  setVisible(n: number) {
    this.visible = clamp(Math.round(n), 1, this.walkers.length)
  }

  step(dt: number) {
    this.acc += Math.min(dt, 0.25)
    while (this.acc >= STEP - 1e-9) {
      this.acc -= STEP
      this.tick(STEP)
    }
  }

  private pickNext(w: Walker) {
    const occupied = new Set(
      this.walkers.filter((o) => o !== w && o.node >= 0).flatMap((o) => [o.node, o.to]),
    )
    const nb = this.adj[w.node] ?? []
    const free = nb.filter((n) => !occupied.has(n))
    const list = free.length > 0 ? free : nb
    if (list.length === 0) return -1
    return list[Math.floor(this.rng() * list.length)]
  }

  private beginEdge(w: Walker, to: number, hop: boolean) {
    const a = this.view[w.node]
    const b = this.view[to]
    const dir = sign(b[0] - a[0])
    w.to = to
    w.s = 0
    w.hop = hop
    w.mode = 'walk'
    if (Math.abs(b[0] - a[0]) > 0.004 && dir !== w.heading) {
      w.heading = dir
      w.turnT = 0
      w.turnDur = this.profile.kind === 'snail' ? 1.6 : 0.5
      w.mode = 'turn'
    }
  }

  private tick(dt: number) {
    this.time += dt
    const a = this.world.aspect
    this.assignFood()
    for (let i = 0; i < this.visible; i++) {
      const w = this.walkers[i]
      if (w.node < 0) continue
      if (w.gulpT >= 0) {
        w.gulpT += dt
        if (w.gulpT >= GULP_SECONDS) w.gulpT = -1
      }
      w.timer -= dt
      let legT = 0
      w.speed = 0
      switch (w.mode) {
        case 'fade': {
          w.alpha = approach(w.alpha, 0, 3, dt)
          if (w.alpha < 0.03) {
            w.alpha = 0
            this.place(w)
            w.mode = 'rest'
          }
          break
        }
        case 'rest': {
          w.alpha = approach(w.alpha, 1, 3, dt)
          // Picking at the surface: quick leg flicks for shrimp, slow antennae for snails.
          legT = this.profile.kind === 'shrimp' ? 1 : 0.3
          if (w.path.length > 0) {
            const next = w.path.shift()!
            if (this.adj[w.node].includes(next)) this.beginEdge(w, next, false)
            else w.path = []
          } else if (w.timer <= 0) {
            const to = this.pickNext(w)
            if (to >= 0) {
              const hop = this.profile.kind === 'shrimp' && this.rng() < 0.1
              this.beginEdge(w, to, hop || (this.profile.model === 'grazer' && this.rng() < 0.12))
            } else w.timer = 5
          }
          break
        }
        case 'turn': {
          w.turnT += dt
          if (w.turnT >= w.turnDur / 2) w.facing = w.heading
          if (w.turnT >= w.turnDur) {
            w.turnT = -1
            w.mode = 'walk'
          }
          break
        }
        case 'walk': {
          const A = this.view[w.node]
          const B = this.view[w.to]
          const len = Math.max(1e-4, Math.hypot(B[0] - A[0], (B[1] - A[1]) / a))
          const v = this.profile.cruiseBl * this.bl * w.speedK * (w.hop ? 4 : 1)
          w.speed = v
          legT = this.profile.kind === 'shrimp' ? 0.8 : 0.4
          w.s += (v * dt) / len
          if (w.s >= 1) {
            w.node = w.to
            w.to = -1
            w.s = 0
            w.mode = 'rest'
            w.hop = false
            w.speed = 0
            w.timer =
              this.profile.kind === 'snail'
                ? lerp(8, 30, this.rng())
                : this.profile.model === 'grazer'
                  ? lerp(8, 35, this.rng())
                  : lerp(0.6, 4, this.rng())
            if (w.food) this.eat(w)
          }
          break
        }
        case 'eat':
          break
      }
      if (this.blocked[w.node] && w.mode !== 'fade') w.mode = 'fade'
      this.setPos(w)
      const arc = w.hop && w.to >= 0 ? Math.sin(Math.PI * w.s) * 0.008 * a : 0
      w.y -= arc
      w.leg = (w.leg + TAU * (7 + 6 * legT) * dt * (legT > 0 ? 1 : 0.2)) % (TAU * 64)
      const target = this.edgePitch(w)
      w.pitch = approach(w.pitch, target, 4, dt)
      w.phase = (w.phase + TAU * 0.6 * dt) % (TAU * 64)
      w.walked += w.speed * dt
    }
  }

  /** Nose-up angle of the edge being walked (the creature faces along it). */
  private edgePitch(w: Walker) {
    if (w.mode !== 'walk' || w.to < 0) return 0
    const A = this.view[w.node]
    const B = this.view[w.to]
    const dx = Math.abs(B[0] - A[0])
    const dyUp = -(B[1] - A[1]) / this.world.aspect
    // Snails keep their shell upright; shrimp and otos follow the slope.
    const lim = this.profile.kind === 'snail' ? 0.3 : 1.2
    return clamp(Math.atan2(dyUp, Math.max(dx, 1e-3)), -lim, lim)
  }

  private eat(w: Walker) {
    const p = w.food
    w.food = null
    if (p && this.pellets.pellets.includes(p)) {
      this.pellets.remove(p)
      w.gulpT = 0
      w.timer = 2.2
    }
  }

  /** Shrimp and snails gather where pellets land. */
  private assignFood() {
    if (this.profile.kind === 'snail' && this.rng() > 0.02) return
    if (this.profile.model === 'grazer') return
    for (const w of this.walkers) {
      if (w.food && !this.pellets.pellets.includes(w.food)) {
        w.food = null
        w.path = []
      }
    }
    for (const p of this.pellets.pellets) {
      if (!this.pellets.isLanded(p) || p.alpha <= 0.3) continue
      // Nearest allowed ground node to the pellet.
      let best = -1
      let bestD = 0.07
      for (let n = 0; n < NODES.length; n++) {
        if (!this.allowed(n) || NODES[n].kind !== 'ground' || this.adj[n].length === 0) continue
        const d = Math.hypot(this.view[n][0] - p.x, (this.view[n][1] - p.y) / this.world.aspect)
        if (d < bestD) {
          best = n
          bestD = d
        }
      }
      if (best < 0) continue
      const have = this.walkers.filter((w) => w.food === p).length
      if (have >= 2) continue
      const cand = this.walkers
        .slice(0, this.visible)
        .filter((w) => !w.food && w.node >= 0 && w.mode === 'rest' && w.path.length === 0)
        .map((w) => {
          const path = this.route(w.node, best)
          return { w, path }
        })
        .filter((c) => c.path !== null)
        .sort((u, v) => u.path!.length - v.path!.length)
        .slice(0, 2 - have)
      for (const c of cand) {
        c.w.food = p
        c.w.path = c.path!
        c.w.timer = 0
        if (c.path!.length === 0) this.eat(c.w)
      }
    }
  }

  /** Shortest path (node ids after the start) over allowed edges, or null. */
  private route(from: number, to: number): number[] | null {
    if (from === to) return []
    const prev = new Map<number, number>([[from, -1]])
    const queue = [from]
    while (queue.length > 0) {
      const n = queue.shift()!
      for (const m of this.adj[n]) {
        if (prev.has(m)) continue
        prev.set(m, n)
        if (m === to) {
          const out: number[] = []
          for (let c: number = to; c !== from; c = prev.get(c)!) out.unshift(c)
          return out
        }
        queue.push(m)
      }
    }
    return null
  }

  frames(): CreatureFrame[] {
    const out: CreatureFrame[] = []
    if (!this.world) return out
    for (let i = 0; i < this.visible; i++) {
      const w = this.walkers[i]
      if (w.node < 0 || w.alpha < 0.02) continue
      // Lower on the plate is nearer the glass: a touch larger.
      const scale = 0.86 + 0.3 * clamp((w.v - 0.35) / 0.55, 0, 1)
      out.push({
        key: w.key,
        species: this.profile.id,
        x: w.x,
        // The feet touch the surface: the body sits above the anchor point.
        y:
          w.y -
          (this.profile.kind === 'snail' ? 0.3 : 0.2) *
            this.profile.ratio *
            this.bl *
            scale *
            this.world.aspect,
        z: 0.5,
        scale,
        fit: 1,
        heading: w.heading,
        facing: w.facing,
        turnProgress: w.turnT >= 0 ? clamp(w.turnT / w.turnDur, 0, 1) : 0,
        pitch: w.pitch,
        speed: w.speed,
        tailPhase: w.phase,
        pecPhase: w.leg,
        wave: w.speed > 0 ? 0.8 : 0.3,
        gulp: w.gulpT >= 0 ? Math.sin((Math.PI * w.gulpT) / GULP_SECONDS) : 0,
        alpha: w.alpha,
        plateSpace: true,
        shadow: true,
        soft: true,
      })
    }
    return out
  }

  /** Anchor positions in view coordinates (for tests). */
  nodePositions(): ReadonlyArray<[number, number]> {
    return this.view
  }
  allowedNode(n: number) {
    return this.allowed(n)
  }
}
