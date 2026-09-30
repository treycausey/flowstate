// A calm school hanging in mid-water: tetras, rasboras, danios, livebearers. Pure and deterministic.
//
// The school has a soft leader (the centre) that wanders slowly and pauses for a long time. Every fish
// steers towards its own slot around the centre (a spiral packing that wobbles slowly), keeps off its
// neighbours, and never swims backwards: to go the other way the whole school reverses, rarely, as a
// ripple that starts at the leading edge. Positions are in world units: x in view widths and
// y in view widths too (normalised y divided by the aspect ratio).

import { mulberry32 as mulberry, scaleForZ, type Rect } from './betta'
import type { PelletField, Pellet } from './pellets'
import { spriteWidth, halfExtents, type SpeciesProfile } from './species'
import {
  approach,
  clamp,
  lerp,
  sign,
  TAU,
  type CreatureFrame,
  type Group,
  type StockContext,
  type World,
} from './creature'

const STEP = 1 / 30
/** Seconds a fish takes to turn round (curve plus foreshortening). */
export const SCHOOL_TURN_SECONDS = 0.9
/** The whole school reverses at most this often. */
export const SCHOOL_REVERSE_GAP = 22
/** Largest perspective scale a school fish reaches (z 0.6). */
const SCALE_MAX = scaleForZ(0.6) * 1.1
const GULP_SECONDS = 0.4

type Fish = {
  key: string
  /** Slot on the unit disc. */
  sx: number
  sy: number
  ph: number
  ph2: number
  zBase: number
  speedK: number
  /** Own size (0.9..1.1), loose jitter of the slot, slow tilt of the heading, tail-beat rate. */
  fit: number
  rj: number
  aj: number
  tiltBias: number
  tailK: number
  x: number
  y: number
  vx: number
  vy: number
  heading: 1 | -1
  facing: 1 | -1
  turnT: number
  turnIn: number
  sinceTurn: number
  z: number
  pitch: number
  tailPhase: number
  pecPhase: number
  food: Pellet | null
  satiated: number
  gulpT: number
}

type Box = { x0: number; x1: number; y0: number; y1: number }

export class SchoolSim implements Group {
  readonly profile: SpeciesProfile
  private world!: World
  private ctx: StockContext = { night: false, dusk: false, mood: 'healthy' }
  private rng: () => number
  private fish: Fish[] = []
  private visible: number
  private wanted: number
  private time = 0
  private acc = 0
  /** Vertical lane (0..1 of the free height) so several schools keep apart. */
  private lane: [number, number]

  // School centre and leader.
  private cx = 0
  private cy = 0
  private cvx = 0
  private cvy = 0
  private goal = { x: 0, y: 0 }
  private pauseLeft = 4
  private dir: 1 | -1 = 1
  private sinceReverse = 12
  private tight = 1

  /** Centre range and fish range in world units. */
  private centreBox: Box = { x0: 0, x1: 1, y0: 0, y1: 1 }
  private fishBox: Box = { x0: 0, x1: 1, y0: 0, y1: 1 }
  private fishRect: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }

  /** Times the hard clamp moved a fish (stays 0 once settled). */
  clampHits = 0
  /** Every individual heading change: [key, time]. */
  readonly turnLog: Array<[string, number]> = []
  reversals = 0
  /** Sim time of every whole-school reversal. */
  readonly reverseLog: number[] = []

  constructor(
    profile: SpeciesProfile,
    count: number,
    seed: number,
    private pellets: PelletField,
    lane: [number, number] = [0, 1],
  ) {
    this.profile = profile
    this.lane = lane
    this.rng = mulberry(seed)
    this.dir = this.rng() < 0.5 ? 1 : -1
    this.breath = this.rng() * TAU
    this.visible = count
    this.wanted = count
    const n = count
    const tiny = profile.lengthCm < 2.2
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + this.rng() * 0.5
      const r = Math.sqrt((i + 0.5) / n)
      this.fish.push({
        key: `${profile.id}-${i}`,
        sx: r * Math.cos(a),
        sy: r * Math.sin(a) * 0.55,
        ph: this.rng() * TAU,
        ph2: this.rng() * TAU,
        zBase: this.rng() * 2 - 1,
        speedK: 0.92 + this.rng() * 0.16,
        fit: 0.9 + this.rng() * 0.2,
        // Tiny fish in big groups need a looser, more uneven packing to avoid a lattice look.
        rj: tiny ? 0.4 + this.rng() * 0.85 : 0.55 + this.rng() * 0.6,
        aj: (this.rng() - 0.5) * (tiny ? 2.4 : 1.2),
        tiltBias: (this.rng() - 0.5) * 0.3,
        tailK: 0.85 + this.rng() * 0.3,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        heading: this.dir,
        facing: this.dir,
        turnT: -1,
        turnIn: -1,
        sinceTurn: 99,
        z: 0.475,
        pitch: 0,
        tailPhase: this.rng() * TAU,
        pecPhase: this.rng() * TAU,
        food: null,
        satiated: 0,
        gulpT: -1,
      })
    }
  }

  // ---- geometry ----

  private get bl() {
    return spriteWidth(this.profile, this.world.fishWidth)
  }

  private formationRadius() {
    const n = this.visible
    return this.profile.spacing * this.bl * Math.sqrt(n) * 0.72 * this.tight
  }

  configure(world: World) {
    const first = !this.world
    this.world = world
    const a = world.aspect
    const f = world.free
    const { hw, hh } = halfExtents(this.profile, world.fishWidth, SCALE_MAX)
    const pad = 0.004
    const width = f.x1 - f.x0
    const height = (f.y1 - f.y0) / a
    // This school's lane of the free water.
    // Room for this many at a comfortable spacing; a short band holds fewer.
    const sp = this.profile.spacing * this.bl
    const room = Math.floor(
      (0.6 * width * height * (this.lane[1] - this.lane[0])) / (sp * sp * 1.5),
    )
    // The formation should leave room to drift: at most about a quarter of the width in radius.
    const radiusFit = Math.floor(
      ((0.26 * width) / (this.profile.spacing * this.bl * 0.72 * 0.85)) ** 2,
    )
    this.visible = Math.min(
      this.wanted,
      Math.max(Math.min(3, this.wanted), Math.min(room, radiusFit)),
    )
    const top = f.y0 / a + height * this.lane[0]
    const bot = f.y0 / a + height * this.lane[1]
    const span = (lo: number, hi: number): [number, number] =>
      hi < lo ? [(lo + hi) / 2, (lo + hi) / 2] : [lo, hi]
    const [fx0, fx1] = span(f.x0 + hw + pad, f.x1 - hw - pad)
    const [fy0, fy1] = span(top + hh + pad, bot + 0 - hh - pad)
    this.fishBox = { x0: fx0, x1: fx1, y0: fy0, y1: fy1 }
    this.fishRect = { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 }
    // The formation is an ellipse packed for the spacing; a short band makes it flat and wide.
    const rx0 = this.formationRadius() / this.tight
    const ryMax = Math.max(0.015, (fy1 - fy0) * 0.42)
    const rxMax = Math.max(0.04, (fx1 - fx0) * 0.45)
    this.ry = Math.min(0.55 * rx0, ryMax)
    this.rx = Math.min((0.55 * rx0 * rx0) / this.ry, rxMax)
    // Slots wobble and neighbours push: keep the centre a little further in.
    const rx = this.rx * 1.2 + this.wobbleX()
    const ry = this.ry + this.wobbleY()
    this.centreBox = {
      x0: Math.min(fx0 + rx, (fx0 + fx1) / 2),
      x1: Math.max(fx1 - rx, (fx0 + fx1) / 2),
      y0: Math.min(fy0 + ry, (fy0 + fy1) / 2),
      y1: Math.max(fy1 - ry, (fy0 + fy1) / 2),
    }
    if (first) {
      this.cx = lerp(this.centreBox.x0, this.centreBox.x1, 0.3 + 0.4 * this.rng())
      this.cy = lerp(this.centreBox.y0, this.centreBox.y1, 0.3 + 0.4 * this.rng())
      this.goal = { x: this.cx, y: this.cy }
      for (const f2 of this.fish) {
        const t = this.slot(f2, 0)
        f2.x = t.x
        f2.y = t.y
        f2.z = this.zFor(f2, 0)
      }
    }
  }

  /** How far a slot drifts about its place, view widths. */
  private wobbleX() {
    return 0.45 * this.bl
  }
  private wobbleY() {
    return Math.min(0.18 * this.bl, 0.3 * this.ry)
  }
  private breath = 0
  private rx = 0.1
  private ry = 0.05

  setContext(ctx: StockContext) {
    this.ctx = ctx
  }

  setVisible(n: number) {
    const v = clamp(Math.round(n), 1, this.fish.length)
    if (v === this.wanted) return
    this.wanted = v
    if (this.world) this.configure(this.world)
  }

  get count() {
    return this.visible
  }

  // ---- slots ----

  private slot(f: Fish, t: number) {
    const rx = this.rx * this.tight
    const ry = this.ry * this.tight
    // Re-pack for the visible count: rank by index on the spiral.
    const i = this.fish.indexOf(f)
    const n = this.visible
    const a = i * 2.39996 + f.aj
    // Loose, uneven packing that stretches and bunches slowly.
    const r = Math.min(1.05, Math.sqrt((i + 0.5) / n) * f.rj)
    const stretch = 1 + 0.2 * Math.sin(0.043 * t + this.breath)
    const squeeze = 1 - 0.12 * Math.sin(0.043 * t + this.breath + 1)
    const wx = this.wobbleX() * (this.tight > 0.8 ? 1 : 0.5)
    return {
      x:
        this.cx +
        r * Math.cos(a) * rx * stretch +
        wx * (0.7 * Math.sin(t * 0.21 + f.ph) + 0.3 * Math.sin(t * 0.47 + f.ph2)),
      y:
        this.cy +
        r * Math.sin(a) * ry * squeeze +
        this.wobbleY() * (0.7 * Math.sin(t * 0.17 + f.ph2) + 0.3 * Math.sin(t * 0.39 + f.ph)),
    }
  }

  private zFor(f: Fish, t: number) {
    const stressed = this.ctx.mood === 'stressed'
    const centre = stressed ? 0.45 : 0.475
    return clamp(centre + 0.125 * (0.85 * f.zBase + 0.15 * Math.sin(t * 0.05 + f.ph)), 0.35, 0.6)
  }

  // ---- leader ----

  private pickGoal() {
    const b = this.centreBox
    const stressed = this.ctx.mood === 'stressed'
    const roomAhead = this.dir === 1 ? b.x1 - this.cx : this.cx - b.x0
    const roomBehind = this.dir === 1 ? this.cx - b.x0 : b.x1 - this.cx
    let dir = this.dir
    if (roomAhead < 0.05 && roomBehind > 0.12 && this.sinceReverse >= SCHOOL_REVERSE_GAP) {
      dir = -dir as 1 | -1
    }
    const room = dir === 1 ? b.x1 - this.cx : this.cx - b.x0
    const dist = Math.min(room, lerp(0.06, 0.28, this.rng() ** 1.3))
    const dx = dir === this.dir && room < 0.04 ? 0 : dir * Math.max(0, dist)
    let gy = lerp(b.y0, b.y1, this.rng())
    if (stressed) gy = lerp(b.y1 - (b.y1 - b.y0) * 0.35, b.y1, this.rng())
    this.goal = { x: clamp(this.cx + dx, b.x0, b.x1), y: clamp(gy, b.y0, b.y1) }
    if (dir !== this.dir) this.reverse(dir)
  }

  private reverse(dir: 1 | -1) {
    this.dir = dir
    this.sinceReverse = 0
    this.reversals++
    this.reverseLog.push(this.time)
    // Ripple: fish at the front (along the old heading) turn first.
    const old = -dir
    const ranks = this.fish.map((f, i) => ({ f, i, p: f.x * old })).sort((a, b) => b.p - a.p)
    ranks.forEach((r, k) => {
      r.f.turnIn = (k / Math.max(1, ranks.length - 1)) * 1.6 + this.rng() * 0.3
    })
  }

  // ---- stepping ----

  step(dt: number) {
    this.acc += Math.min(dt, 0.25)
    while (this.acc >= STEP - 1e-9) {
      this.acc -= STEP
      this.tick(STEP)
    }
  }

  private tick(dt: number) {
    this.time += dt
    this.sinceReverse += dt
    const stressed = this.ctx.mood === 'stressed'
    this.tight = approach(this.tight, stressed ? 0.6 : 1, 0.4, dt)
    const vC = this.profile.cruiseBl * this.bl * (stressed ? 0.7 : 1)
    const cb = this.centreBox

    // Leader: drift to the goal, then hang for a long while.
    if (this.pauseLeft > 0) {
      this.pauseLeft -= dt
      this.cvx = approach(this.cvx, 0, 0.7, dt)
      this.cvy = approach(this.cvy, 0, 0.7, dt)
      if (this.pauseLeft <= 0) this.pickGoal()
    } else {
      const dx = this.goal.x - this.cx
      const dy = this.goal.y - this.cy
      const d = Math.hypot(dx, dy)
      if (d < 0.008) {
        this.pauseLeft = lerp(3, 10, this.rng())
      } else {
        const want = Math.min(vC, d * 0.35)
        this.cvx = approach(this.cvx, (dx / d) * want, 0.6, dt)
        this.cvy = approach(this.cvy, (dy / d) * want, 0.6, dt)
      }
    }
    this.cx = clamp(this.cx + this.cvx * dt, cb.x0, cb.x1)
    this.cy = clamp(this.cy + this.cvy * dt, cb.y0, cb.y1)

    this.assignFood()
    const n = this.visible
    const sepR = 1.0 * this.bl
    const fb = this.fishBox
    for (let i = 0; i < n; i++) {
      const f = this.fish[i]
      f.sinceTurn += dt
      f.satiated = Math.max(0, f.satiated - dt)
      if (f.gulpT >= 0) {
        f.gulpT += dt
        if (f.gulpT >= GULP_SECONDS) f.gulpT = -1
      }
      // Turn bookkeeping.
      if (f.turnIn >= 0) {
        f.turnIn -= dt
        if (f.turnIn < 0) this.startTurn(f, this.dir)
      }
      if (f.turnT >= 0) {
        f.turnT += dt
        if (f.turnT >= SCHOOL_TURN_SECONDS) f.turnT = -1
        else if (f.turnT >= SCHOOL_TURN_SECONDS / 2) f.facing = f.heading
      }

      let vdx: number
      let vdy: number
      let vmax = vC * 1.8 * f.speedK
      const food = f.food
      if (food) {
        const reach = 0.42 * this.bl * scaleForZ(f.z)
        const ahead = (food.x - f.x) * f.heading
        if (ahead < -0.3 * this.bl && f.turnT < 0 && f.sinceTurn > 3)
          this.startTurn(f, sign(food.x - f.x))
        const tx = food.x - f.heading * reach
        const ty = food.y / this.world.aspect
        const dx = tx - f.x
        const dy = ty - f.y
        const d = Math.hypot(dx, dy)
        vmax = vC * 3.2
        const want = Math.min(vmax, d * 1.4 + 0.004)
        vdx = d > 1e-5 ? (dx / d) * want : 0
        vdy = d > 1e-5 ? (dy / d) * want : 0
        if (f.turnT >= 0) {
          vdx *= 0.3
          vdy *= 0.3
        }
        if (
          d < 0.3 * this.bl ||
          Math.hypot(food.x - (f.x + f.heading * reach), ty - f.y) < 0.28 * this.bl
        ) {
          this.pellets.remove(food)
          f.food = null
          f.satiated = 6
          f.gulpT = 0
        }
      } else {
        const s = this.slot(f, this.time)
        let dx = s.x - f.x
        let dy = s.y - f.y
        // Spring to the slot; speed-limited so the catch-up is a glide.
        const d = Math.hypot(dx, dy)
        const want = Math.min(vC * 1.6 * f.speedK, d * 0.9)
        if (d > 1e-6) {
          dx = (dx / d) * want
          dy = (dy / d) * want
        }
        vdx = this.cvx + dx
        vdy = this.cvy + dy
        // Keep off neighbours.
        for (let j = 0; j < n; j++) {
          if (j === i) continue
          const o = this.fish[j]
          // Sprites are wider than tall: the keep-off distance is an ellipse.
          const ox = f.x - o.x
          const oy = (f.y - o.y) / (this.profile.ratio * 1.5)
          const od = Math.hypot(ox, oy)
          if (od < sepR && od > 1e-6) {
            const push = (1 - od / sepR) * vC * 1.2
            vdx += (ox / od) * push
            vdy += (oy / od) * push * 0.4
          }
        }
        // Never backwards: the school reverses as a whole.
        if (vdx * f.heading < 0) vdx = 0
        if (f.turnT >= 0) {
          vdx *= 0.4
          vdy *= 0.4
        }
      }
      const vm = Math.hypot(vdx, vdy)
      if (vm > vmax) {
        vdx *= vmax / vm
        vdy *= vmax / vm
      }
      f.vx = approach(f.vx, vdx, 1.3, dt)
      f.vy = approach(f.vy, vdy, 1.3, dt)
      const nx = f.x + f.vx * dt
      const ny = f.y + f.vy * dt
      const cxp = clamp(nx, fb.x0, fb.x1)
      const cyp = clamp(ny, fb.y0, fb.y1)
      if (cxp !== nx || cyp !== ny) {
        // Count only real overshoots; grazing the edge of the box is how a fish stops there.
        if (this.settled && Math.hypot(cxp - nx, cyp - ny) > 0.05 * this.bl) this.clampHits++
        if (cxp !== nx) f.vx = 0
        if (cyp !== ny) f.vy = 0
      }
      f.x = cxp
      f.y = cyp
      f.z = approach(f.z, this.zFor(f, this.time), 0.3, dt)

      const speed = Math.hypot(f.vx, f.vy)
      const idle = clamp(speed / Math.max(vC, 1e-4), 0, 1.6)
      f.tailPhase =
        (f.tailPhase + TAU * this.profile.tailHz * f.tailK * (0.3 + 0.7 * Math.min(1, idle)) * dt) %
        (TAU * 64)
      f.pecPhase = (f.pecPhase + TAU * 5.2 * dt) % (TAU * 64)
      f.pitch = approach(
        f.pitch,
        clamp(Math.atan2(-f.vy, Math.abs(f.vx) + 0.012) * 0.7, -0.28, 0.28),
        3,
        dt,
      )
    }
  }

  private get settled() {
    return this.time > 3
  }

  private startTurn(f: Fish, toward: 1 | -1) {
    if (f.turnT >= 0 || toward === f.heading) return
    f.heading = toward
    f.turnT = 0
    f.sinceTurn = 0
    this.turnLog.push([f.key, this.time])
  }

  /** Nearest few fish go for each falling pellet they can reach. */
  private assignFood() {
    const fr = this.fishRect
    const a = this.world.aspect
    const taken = new Set<Fish>()
    for (const f of this.fish) if (f.food) taken.add(f)
    for (const f of this.fish) {
      if (f.food && (f.food.alpha <= 0.5 || !this.pellets.pellets.includes(f.food))) f.food = null
    }
    for (const p of this.pellets.pellets) {
      if (p.alpha <= 0.5 || this.pellets.isLanded(p)) continue
      if (p.x < fr.x0 - this.bl || p.x > fr.x1 + this.bl || p.y > fr.y1 + 0.3 * this.bl * a)
        continue
      const have = this.fish.filter((f) => f.food === p).length
      if (have >= 3) continue
      const cand = this.fish
        .slice(0, this.visible)
        .filter((f) => !f.food && f.satiated <= 0)
        .map((f) => ({ f, d: Math.hypot(f.x - p.x, f.y - p.y / a) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 3 - have)
      for (const c of cand) c.f.food = p
    }
  }

  // ---- output ----

  frames(): CreatureFrame[] {
    const a = this.world.aspect
    const vC = this.profile.cruiseBl * this.bl
    const out: CreatureFrame[] = []
    for (let i = 0; i < this.visible; i++) {
      const f = this.fish[i]
      const speed = Math.hypot(f.vx, f.vy)
      out.push({
        key: f.key,
        species: this.profile.id,
        x: f.x,
        y: f.y * a,
        z: f.z,
        scale: scaleForZ(f.z) * f.fit,
        fit: 1,
        heading: f.heading,
        facing: f.facing,
        turnProgress: f.turnT >= 0 ? clamp(f.turnT / SCHOOL_TURN_SECONDS, 0, 1) : 0,
        pitch:
          f.pitch +
          f.tiltBias +
          0.12 * Math.sin(this.time * 0.13 + f.ph) +
          (f.gulpT >= 0 ? Math.sin((Math.PI * f.gulpT) / GULP_SECONDS) * 0.12 : 0),
        speed,
        tailPhase: f.tailPhase,
        pecPhase: f.pecPhase,
        wave: clamp(0.25 + (speed / Math.max(vC, 1e-4)) * 0.5, 0, 1.4),
        gulp: f.gulpT >= 0 ? Math.sin((Math.PI * f.gulpT) / GULP_SECONDS) : 0,
        alpha: 1,
        plateSpace: false,
        shadow: false,
        soft: false,
      })
    }
    return out
  }

  /** The free-water box the fish centres live in, in world units (for tests). */
  box(): Box {
    return { ...this.fishBox }
  }
}
