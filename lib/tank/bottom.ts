// Bottom dwellers: corydoras patrol the substrate in short hops with pauses, and sometimes one darts to
// the surface and back. Kuhli loaches stay hidden by day and slither along the substrate at dusk and
// night. Pure and deterministic. Positions are normalised view coordinates; speeds are view widths.

import { mulberry32 as mulberry, scaleForZ } from './betta'
import type { Pellet, PelletField } from './pellets'
import { halfExtents, spriteWidth, type SpeciesProfile } from './species'
import {
  approach,
  bandInterval,
  clamp,
  lerp,
  sign,
  smooth,
  TAU,
  type CreatureFrame,
  type Group,
  type StockContext,
  type World,
} from './creature'

const STEP = 1 / 30
export const CORY_TURN_SECONDS = 0.8
/** A cory may turn round at most this often. */
export const CORY_TURN_GAP = 15
const GULP_SECONDS = 0.4
/** Seconds between surface darts, per tank. */
const DART_MIN = 120
const DART_MAX = 300
/** Height of the walking band above the substrate line, normalised. */
const BAND = 0.045

type CoryMode = 'pause' | 'hop' | 'food' | 'up' | 'hold' | 'down'

type Cory = {
  key: string
  offset: number
  ph: number
  z: number
  speedK: number
  x: number
  y: number
  baseY: number
  heading: 1 | -1
  facing: 1 | -1
  turnT: number
  sinceTurn: number
  mode: CoryMode
  timer: number
  dur: number
  sx: number
  sy: number
  tx: number
  ty: number
  speed: number
  pitch: number
  wiggle: number
  tailPhase: number
  pecPhase: number
  gulpT: number
  food: Pellet | null
}

export class CorySim implements Group {
  readonly profile: SpeciesProfile
  private world!: World
  private ctx: StockContext = { night: false, dusk: false, mood: 'healthy' }
  private rng: () => number
  private corys: Cory[] = []
  private visible: number
  private ok = true
  private time = 0
  private acc = 0
  private gx = 0.5
  private gxTimer = 0
  private nextDart: number
  /** Normalised walking band and x-range (centres). */
  band = { x0: 0, x1: 1, y0: 0.8, y1: 0.9 }
  /** Normalised rect a dart may use (x-range of the open water). */
  dartX: [number, number] = [0, 1]
  dartTop = 0.14
  darts = 0
  readonly turnLog: Array<[string, number]> = []
  clampHits = 0

  constructor(
    profile: SpeciesProfile,
    count: number,
    seed: number,
    private pellets: PelletField,
  ) {
    this.profile = profile
    this.rng = mulberry(seed)
    this.visible = count
    this.nextDart = lerp(DART_MIN * 0.5, DART_MAX * 0.6, this.rng())
    for (let i = 0; i < count; i++) {
      const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1
      this.corys.push({
        key: `${profile.id}-${i}`,
        offset: (i / Math.max(1, count - 1) - 0.5) * 2,
        ph: this.rng() * TAU,
        z: 0.49 + this.rng() * 0.04,
        speedK: 0.85 + this.rng() * 0.3,
        x: 0.5,
        y: 0.88,
        baseY: 0.5,
        heading: dir,
        facing: dir,
        turnT: -1,
        sinceTurn: 99,
        mode: 'pause',
        timer: 1 + this.rng() * 4,
        dur: 1,
        sx: 0,
        sy: 0,
        tx: 0,
        ty: 0,
        speed: 0,
        pitch: 0,
        wiggle: 0,
        tailPhase: this.rng() * TAU,
        pecPhase: this.rng() * TAU,
        gulpT: -1,
        food: null,
      })
    }
  }

  private get bl() {
    return spriteWidth(this.profile, this.world.fishWidth)
  }

  configure(world: World) {
    const first = !this.world
    this.world = world
    const { hw } = halfExtents(this.profile, world.fishWidth, scaleForZ(0.56))
    const y1 = world.floorY - 0.005
    const y0 = y1 - BAND
    const [i0, i1] = bandInterval(world, y0 - 0.05, y1 + 0.02)
    const lo = i0 + hw + 0.004
    const hi = i1 - hw - 0.004
    // A band the panel covers leaves no room: the group stays out of sight.
    this.ok = hi - lo > 0.02
    this.band = {
      x0: Math.min(lo, (lo + hi) / 2),
      x1: Math.max(hi, (lo + hi) / 2),
      y0,
      y1,
    }
    // A dart rises through open water: only where the panel leaves the column free.
    const f = world.free
    this.dartX = [Math.max(f.x0 + hw, this.band.x0), Math.min(f.x1 - hw, this.band.x1)]
    this.dartTop = f.y0 + 0.06
    if (first) {
      this.gx = lerp(this.band.x0, this.band.x1, 0.5)
      for (const c of this.corys) {
        c.x = clamp(this.gx + c.offset * this.spread(), this.band.x0, this.band.x1)
        c.baseY = this.rng()
        c.y = this.bandY(c)
      }
    }
  }

  private bandY(c: Cory) {
    return lerp(this.band.y0, this.band.y1, c.baseY)
  }

  /** Half-width of the group around its centre, view widths. */
  private spread() {
    return Math.min(
      this.profile.spacing * this.bl * this.visible * 0.5,
      (this.band.x1 - this.band.x0) * 0.5,
    )
  }

  setContext(ctx: StockContext) {
    this.ctx = ctx
  }

  setVisible(n: number) {
    this.visible = clamp(Math.round(n), 1, this.corys.length)
  }

  step(dt: number) {
    this.acc += Math.min(dt, 0.25)
    while (this.acc >= STEP - 1e-9) {
      this.acc -= STEP
      this.tick(STEP)
    }
  }

  private pickHop(c: Cory, forced?: { x: number; y: number }) {
    const b = this.band
    let tx: number
    let ty = lerp(b.y0, b.y1, this.rng())
    if (forced) {
      tx = forced.x
      ty = clamp(forced.y, b.y0, b.y1)
    } else {
      tx = clamp(this.gx + c.offset * this.spread() + (this.rng() - 0.5) * 0.08, b.x0, b.x1)
      // A short hop, not a run.
      const maxHop = this.bl * lerp(1.2, 3.2, this.rng())
      tx = clamp(tx, c.x - maxHop, c.x + maxHop)
    }
    let dir = sign(tx - c.x)
    const turnGap = forced ? 3 : CORY_TURN_GAP
    if (Math.abs(tx - c.x) > 0.008 && dir !== c.heading) {
      if (c.sinceTurn < turnGap || c.turnT >= 0) {
        // Not allowed to turn yet: hop the other way only if it is forward, otherwise rest.
        if (forced) return false
        tx = c.x + c.heading * Math.min(this.bl * 1.2, c.heading === 1 ? b.x1 - c.x : c.x - b.x0)
        dir = c.heading
      } else {
        c.heading = dir
        c.turnT = 0
        c.sinceTurn = 0
        this.turnLog.push([c.key, this.time])
      }
    }
    const dist = Math.hypot(tx - c.x, (ty - c.y) / this.world.aspect)
    if (dist < 0.004) return false
    const v =
      this.profile.cruiseBl * this.bl * c.speedK * (forced ? 2.2 : lerp(0.9, 1.5, this.rng()))
    c.mode = forced ? 'food' : 'hop'
    c.sx = c.x
    c.sy = c.y
    c.tx = tx
    c.ty = ty
    c.timer = 0
    c.dur = Math.max(0.6, (dist / v) * 1.4)
    return true
  }

  private tick(dt: number) {
    this.time += dt
    const stressed = this.ctx.mood === 'stressed'
    this.gxTimer -= dt
    if (this.gxTimer <= 0) {
      this.gxTimer = lerp(20, 45, this.rng())
      this.gx = lerp(this.band.x0, this.band.x1, this.rng())
    }
    // Group centre stays far enough from the ends that the spread fits.
    const sp = this.spread()
    this.gx = clamp(this.gx, this.band.x0 + sp * 0.3, this.band.x1 - sp * 0.3)

    this.nextDart -= dt
    if (this.nextDart <= 0) {
      this.nextDart = lerp(DART_MIN, DART_MAX, this.rng())
      if (!stressed) this.dart()
    }
    this.assignFood()

    const a = this.world.aspect
    for (let i = 0; i < this.visible; i++) {
      const c = this.corys[i]
      c.sinceTurn += dt
      if (c.gulpT >= 0) {
        c.gulpT += dt
        if (c.gulpT >= GULP_SECONDS) c.gulpT = -1
      }
      if (c.turnT >= 0) {
        c.turnT += dt
        if (c.turnT >= CORY_TURN_SECONDS) c.turnT = -1
        else if (c.turnT >= CORY_TURN_SECONDS / 2) c.facing = c.heading
      }
      const px = c.x
      const py = c.y
      c.timer += dt
      let pitchTarget = 0
      let wiggleTarget = 0
      switch (c.mode) {
        case 'pause': {
          // Snout down, working the substrate.
          pitchTarget = -0.15
          wiggleTarget = 1
          if (c.timer >= c.dur) {
            c.timer = 0
            if (!this.pickHop(c)) c.dur = lerp(1.5, 4, this.rng())
          }
          break
        }
        case 'hop':
        case 'food': {
          const k = smooth(c.timer / c.dur)
          c.x = lerp(c.sx, c.tx, k)
          c.y = lerp(c.sy, c.ty, k)
          pitchTarget = -0.05
          if (c.mode === 'food' && c.food) {
            // The pellet may have been eaten or faded meanwhile.
            if (!this.pellets.pellets.includes(c.food)) {
              c.food = null
              c.mode = 'pause'
              c.timer = 0
              c.dur = 1
            }
          }
          if (c.timer >= c.dur) {
            if (c.mode === 'food' && c.food) {
              this.pellets.remove(c.food)
              c.food = null
              c.gulpT = 0
              c.dur = 3.5
            } else {
              c.dur = lerp(1.5, 6, this.rng())
            }
            c.mode = 'pause'
            c.timer = 0
          }
          break
        }
        case 'up': {
          const k = smooth(c.timer / c.dur)
          c.y = lerp(c.sy, c.ty, k)
          pitchTarget = 0.9
          wiggleTarget = 1
          if (c.timer >= c.dur) {
            c.mode = 'hold'
            c.timer = 0
            c.dur = 0.5
          }
          break
        }
        case 'hold': {
          pitchTarget = 0
          if (c.timer >= c.dur) {
            c.mode = 'down'
            c.timer = 0
            c.dur = 3.2
            c.sy = c.y
            c.ty = this.bandY(c)
          }
          break
        }
        case 'down': {
          const k = smooth(c.timer / c.dur)
          c.y = lerp(c.sy, c.ty, k)
          pitchTarget = -0.7
          if (c.timer >= c.dur) {
            c.mode = 'pause'
            c.timer = 0
            c.dur = 3
          }
          break
        }
      }
      const b = this.band
      const darting = c.mode === 'up' || c.mode === 'hold' || c.mode === 'down'
      const cx = clamp(c.x, b.x0, b.x1)
      const cy = darting ? c.y : clamp(c.y, b.y0, b.y1)
      if ((cx !== c.x || cy !== c.y) && this.time > 3) this.clampHits++
      c.x = cx
      c.y = cy
      c.speed = Math.hypot(c.x - px, (c.y - py) / a) / dt
      c.pitch = approach(c.pitch, pitchTarget, 4, dt)
      c.wiggle = approach(c.wiggle, wiggleTarget, 3, dt)
      const hz =
        this.profile.tailHz *
        (0.25 + 0.75 * clamp(c.speed / (this.profile.cruiseBl * this.bl), 0, 1.6))
      c.tailPhase = (c.tailPhase + TAU * (hz + c.wiggle * 1.3) * dt) % (TAU * 64)
      c.pecPhase = (c.pecPhase + TAU * 4.5 * dt) % (TAU * 64)
    }
  }

  /** One cory darts to the surface and back, if a free column lets it. */
  dart(): boolean {
    const ok = this.corys
      .slice(0, this.visible)
      .filter(
        (c) =>
          c.mode === 'pause' &&
          c.turnT < 0 &&
          c.x >= this.dartX[0] &&
          c.x <= this.dartX[1] &&
          this.dartX[1] > this.dartX[0],
      )
    if (ok.length === 0) return false
    const c = ok[Math.floor(this.rng() * ok.length)]
    c.mode = 'up'
    c.timer = 0
    c.dur = 2.6
    c.sy = c.y
    c.ty = this.dartTop
    this.darts++
    return true
  }

  private assignFood() {
    for (const c of this.corys) {
      if (c.food && !this.pellets.pellets.includes(c.food)) c.food = null
    }
    for (const p of this.pellets.pellets) {
      if (!this.pellets.isLanded(p) || p.alpha <= 0.3) continue
      if (p.x < this.band.x0 - this.bl || p.x > this.band.x1 + this.bl) continue
      const have = this.corys.filter((c) => c.food === p).length
      if (have >= 2) continue
      const cand = this.corys
        .slice(0, this.visible)
        .filter((c) => !c.food && (c.mode === 'pause' || c.mode === 'hop') && c.turnT < 0)
        .sort((u, v) => Math.abs(u.x - p.x) - Math.abs(v.x - p.x))
        .slice(0, 2 - have)
      for (const c of cand) {
        c.food = p
        const target = { x: clamp(p.x, this.band.x0, this.band.x1), y: p.y - 0.01 }
        if (!this.pickHop(c, target)) c.food = null
      }
    }
  }

  frames(): CreatureFrame[] {
    const out: CreatureFrame[] = []
    if (!this.ok) return out
    const vC = this.profile.cruiseBl * this.bl
    for (let i = 0; i < this.visible; i++) {
      const c = this.corys[i]
      const moving = clamp(c.speed / Math.max(vC, 1e-4), 0, 1.6)
      out.push({
        key: c.key,
        species: this.profile.id,
        x: c.x,
        y: c.y,
        z: c.z,
        scale: scaleForZ(c.z),
        fit: 1,
        heading: c.heading,
        facing: c.facing,
        turnProgress: c.turnT >= 0 ? clamp(c.turnT / CORY_TURN_SECONDS, 0, 1) : 0,
        pitch: c.pitch + Math.sin(c.tailPhase * 0.9) * 0.03 * c.wiggle,
        speed: c.speed,
        tailPhase: c.tailPhase,
        pecPhase: c.pecPhase,
        wave: 0.25 + 0.6 * Math.min(1, moving) + 0.25 * c.wiggle,
        gulp: c.gulpT >= 0 ? Math.sin((Math.PI * c.gulpT) / GULP_SECONDS) : 0,
        alpha: 1,
        plateSpace: false,
        // In the water column the shadow would float: only near the substrate.
        shadow: c.y > this.band.y0 - 0.03,
        soft: false,
      })
    }
    return out
  }
}

type LoachMode = 'hidden' | 'go'
type Loach = {
  key: string
  mode: LoachMode
  timer: number
  x: number
  y: number
  sx: number
  ex: number
  t: number
  dur: number
  heading: 1 | -1
  alpha: number
  tailPhase: number
  speed: number
}

/** Plate-space foot points of the rocks where loaches come and go (plate u). */
const ROCK_EDGES_U = [0.1, 0.4, 0.62, 0.9]
const PLATE_FLOOR_V = 0.92

export class KuhliSim implements Group {
  readonly profile: SpeciesProfile
  private world!: World
  private ctx: StockContext = { night: false, dusk: false, mood: 'healthy' }
  private rng: () => number
  private loaches: Loach[] = []
  private visible: number
  private ok = true
  private acc = 0
  private time = 0
  private x0 = 0
  private x1 = 1
  private y = 0.9
  readonly paths: Array<[number, number]> = []

  constructor(profile: SpeciesProfile, count: number, seed: number, _pellets?: PelletField) {
    void _pellets
    this.profile = profile
    this.rng = mulberry(seed)
    this.visible = count
    for (let i = 0; i < count; i++) {
      this.loaches.push({
        key: `${profile.id}-${i}`,
        mode: 'hidden',
        timer: 4 + this.rng() * 20 + i * 12,
        x: 0,
        y: 0,
        sx: 0,
        ex: 0,
        t: 0,
        dur: 1,
        heading: 1,
        alpha: 0,
        tailPhase: this.rng() * TAU,
        speed: 0,
      })
    }
  }

  private get bl() {
    return spriteWidth(this.profile, this.world.fishWidth)
  }

  configure(world: World) {
    this.world = world
    const { hw } = halfExtents(this.profile, world.fishWidth, 1)
    const [i0, i1] = bandInterval(world, world.floorY - 0.08, world.floorY + 0.02)
    this.x0 = i0 + hw
    this.x1 = Math.max(this.x0, i1 - hw)
    this.ok = i1 - i0 > 2 * hw + 0.02
    this.y = world.floorY - 0.014
  }

  setContext(ctx: StockContext) {
    this.ctx = ctx
  }

  setVisible(n: number) {
    this.visible = clamp(Math.round(n), 1, this.loaches.length)
  }

  step(dt: number) {
    this.acc += Math.min(dt, 0.25)
    while (this.acc >= STEP - 1e-9) {
      this.acc -= STEP
      this.tick(STEP)
    }
  }

  private start(l: Loach) {
    const w = this.world
    const edges = ROCK_EDGES_U.map((u) => w.plateToView(u, PLATE_FLOOR_V)[0]).filter(
      (x) => x >= this.x0 && x <= this.x1,
    )
    const pool = edges.length > 0 ? edges : [(this.x0 + this.x1) / 2]
    const sx = pool[Math.floor(this.rng() * pool.length)]
    // Go towards the roomier side, to an edge or as far as a slither reaches.
    const room = sx - this.x0 > this.x1 - sx ? -1 : 1
    const dir: 1 | -1 = this.rng() < 0.7 ? (room as 1 | -1) : (-room as 1 | -1)
    const reach = dir === 1 ? this.x1 - sx : sx - this.x0
    const len = Math.min(reach, lerp(0.18, 0.4, this.rng()))
    l.mode = 'go'
    l.sx = sx
    l.ex = sx + dir * len
    l.heading = dir
    l.t = 0
    l.dur = Math.max(4, len / (this.profile.cruiseBl * this.bl * lerp(0.8, 1.2, this.rng())))
    this.paths.push([l.sx, l.ex])
  }

  private tick(dt: number) {
    this.time += dt
    const active = this.ctx.night || this.ctx.dusk
    for (let i = 0; i < this.visible; i++) {
      const l = this.loaches[i]
      if (l.mode === 'hidden') {
        l.alpha = 0
        l.speed = 0
        l.timer -= dt
        if (l.timer <= 0) {
          if (active && this.ok && this.ctx.mood !== 'stressed') this.start(l)
          else l.timer = 15 + this.rng() * 20
        }
      } else {
        l.t += dt
        const k = clamp(l.t / l.dur, 0, 1)
        const px = l.x
        l.x = lerp(l.sx, l.ex, k)
        l.y = this.y
        l.speed = Math.abs(l.x - px) / dt
        // Out of the rocks, along the substrate, back behind them.
        l.alpha = smooth(k / 0.18) * smooth((1 - k) / 0.18)
        l.tailPhase = (l.tailPhase + TAU * this.profile.tailHz * dt) % (TAU * 64)
        if (l.t >= l.dur) {
          l.mode = 'hidden'
          l.alpha = 0
          l.timer = lerp(25, 80, this.rng())
        }
      }
    }
  }

  frames(): CreatureFrame[] {
    const out: CreatureFrame[] = []
    if (!this.ok) return out
    for (let i = 0; i < this.visible; i++) {
      const l = this.loaches[i]
      if (l.mode !== 'go' || l.alpha < 0.01) continue
      out.push({
        key: l.key,
        species: this.profile.id,
        x: l.x,
        y: l.y,
        z: 0.52,
        scale: scaleForZ(0.52),
        fit: 1,
        heading: l.heading,
        facing: l.heading,
        turnProgress: 0,
        pitch: 0,
        speed: l.speed,
        tailPhase: l.tailPhase,
        pecPhase: 0,
        wave: 1,
        gulp: 0,
        alpha: l.alpha,
        plateSpace: false,
        shadow: true,
        soft: false,
      })
    }
    return out
  }
}
