// Behaviour and steering for the betta. Pure and deterministic: seeded RNG, injected dt, no DOM.
//
// Coordinates are normalised to the viewport: x and y in 0..1. Distances and speeds are measured in
// viewport widths (y is divided by the aspect ratio first), so 0.06 means 6% of the width per second
// in any direction. z is depth for focus: 0 far, 0.5 focal plane, 1 near the glass.

import type { Mood } from './waterState'

export type BettaMode = 'wander' | 'approach' | 'chase' | 'flare' | 'rest' | 'sulk' | 'inspect'

export type Rect = { x0: number; y0: number; x1: number; y1: number }

export type BettaConfig = {
  /** Viewport width / height. */
  aspect: number
  /** Sprite width in viewport widths. */
  fishWidth: number
  /** Optional UI panel to swim around, normalised. */
  exclusion: Rect | null
  /** Where the fish beds down at night, normalised. */
  restSpot: { x: number; y: number }
}

export type BettaContext = { night: boolean; mood: Mood }

export type Pellet = { id: number; x: number; y: number; age: number; alpha: number }

export type BettaFrame = {
  mode: BettaMode
  x: number
  y: number
  z: number
  /** Sprite scale from perspective (1 at the focal plane). */
  scale: number
  /** Direction the fish is heading: +1 right, -1 left. */
  heading: 1 | -1
  /** Direction the drawn sprite faces: flips at the midpoint of a turn. */
  facing: 1 | -1
  /** Swim speed in viewport widths per second. */
  speed: number
  /** 0 when not turning, otherwise 0..1 through the turn. */
  turnProgress: number
  /** Nose-up angle in radians, small. */
  pitch: number
  pose: { cruise: number; flare: number; clamped: number }
  finSpread: number
  tailBeatPhase: number
  pectoralPhase: number
  breathPhase: number
  /** Acceleration in fish-local axes (forward, up), viewport widths per second squared. */
  accel: { forward: number; up: number }
  /** 0..1 while the fish stares out of the glass (inspect). */
  viewerFacing: number
  /** 0..1 pulse right after the fish swallows a pellet. */
  gulp: number
  pellets: readonly Pellet[]
}

export const TURN_SECONDS = 0.45
export const CRUISE_SPEED = 0.06
export const IDLE_INSPECT_SECONDS = 120
export const LOOP_SECONDS = 1.1
const GULP_SECONDS = 0.4

const TAU = Math.PI * 2
const MAX_SUBSTEP = 1 / 60

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Frame-rate independent exponential approach. */
const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))
const sign = (v: number): 1 | -1 => (v < 0 ? -1 : 1)

const DEFAULT_CONFIG: BettaConfig = {
  aspect: 1.6,
  fishWidth: 0.3,
  exclusion: null,
  restSpot: { x: 0.74, y: 0.3 },
}

type Vec = { x: number; y: number }

export class BettaSim {
  private cfg: BettaConfig
  private rng: () => number
  private ctx: BettaContext = { night: false, mood: 'healthy' }

  // Kinematics. Position is normalised; velocity is in viewport widths per second.
  private px = 0.6
  private py = 0.42
  private vx = 0
  private vy = 0
  private z = 0.5
  private heading: 1 | -1 = 1
  private facing: 1 | -1 = 1
  private turnT = -1 // seconds into the current turn, -1 when not turning
  private sinceTurn = 99
  private prevAx = 0
  private prevAy = 0
  private accelF = 0
  private accelU = 0
  private pitch = 0

  private mode: BettaMode = 'wander'
  private time = 0
  private target: Vec = { x: 0.6, y: 0.42 }
  private targetTimer = 0
  private pauseTimer = 0
  private flareTimer = 0
  private lookTimer = 0
  private lookDir: 1 | -1 = 1
  private satisfiedTimer = 0
  private idleTime = 0
  private sinceInspect = 240
  private inspectStage: 'in' | 'stare' | 'out' = 'in'
  private inspectTimer = 0
  private focusPoint: Vec | null = null
  private pellets: Pellet[] = []
  private nextPelletId = 1
  private noiseSeed: [number, number, number, number]

  private pose = { cruise: 1, flare: 0, clamped: 0 }
  private finSpread = 0.75
  private tailPhase = 0
  private pectoralPhase = 0
  private breathPhase = 0
  private viewerFacing = 0
  private loopT = -1
  private gulpT = -1
  private zTarget = 0.5

  constructor(seed = 1, config: Partial<BettaConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config }
    this.rng = mulberry32(seed)
    this.noiseSeed = [this.rng() * TAU, this.rng() * TAU, this.rng() * TAU, this.rng() * TAU]
    const start = this.project(0.62, 0.42)
    this.px = start.x
    this.py = start.y
    this.target = { ...start }
    this.pickWanderTarget()
  }

  configure(partial: Partial<BettaConfig>) {
    this.cfg = { ...this.cfg, ...partial }
    const p = this.project(this.px, this.py)
    this.px = p.x
    this.py = p.y
  }

  setContext(ctx: BettaContext) {
    this.ctx = ctx
  }

  // ---- input events ----

  /** Any user activity resets the idle timer and cancels an inspect. */
  activity() {
    this.idleTime = 0
    if (this.mode === 'inspect' && this.inspectStage !== 'out') {
      this.inspectStage = 'out'
      this.inspectTimer = 0
    }
  }

  /** `at` is normalised; without it the pellet falls from near the surface at a random spot. */
  dropPellet(at?: Vec) {
    this.activity()
    const reach = this.mouthOffset()
    const b = this.bounds()
    // Just ahead of the fish, so the drop reads as "for the betta".
    const fallback = { x: this.px + this.heading * (reach + 0.05 + this.rng() * 0.05), y: 0.08 }
    const raw = at ?? fallback
    const x = clamp(raw.x, b.x0 + reach, Math.max(b.x0 + reach, b.x1 - reach))
    const safeX = this.pushOutOfExclusionX(x, reach)
    this.pellets.push({
      id: this.nextPelletId++,
      x: safeX,
      y: clamp(raw.y, 0.03, 0.2),
      age: 0,
      alpha: 1,
    })
    if (this.pellets.length > 6) this.pellets.shift()
  }

  flare() {
    this.activity()
    this.flareTimer = 1.5 + this.rng()
  }

  /** The "betta" easter egg: a happy flare and one quick loop-the-loop. */
  celebrate() {
    this.activity()
    this.flareTimer = 2.2
    this.loopT = 0
  }

  /** Tap somewhere else: the fish turns to look and hangs still for a moment. */
  lookAt(at: Vec) {
    this.activity()
    this.lookDir = sign(at.x - this.px)
    this.lookTimer = 1.4
  }

  focusAt(at: Vec) {
    this.activity()
    this.focusPoint = { ...at }
  }

  blur() {
    this.focusPoint = null
  }

  /** Force the idle easter egg (dev drawer). */
  triggerInspect() {
    this.startInspect()
  }

  // ---- geometry ----

  private halfWidth() {
    return this.cfg.fishWidth * 0.5
  }

  private halfHeightN() {
    return this.cfg.fishWidth * 0.3 * this.cfg.aspect
  }

  /** Mouth distance ahead of the sprite centre, viewport widths. */
  mouthOffset() {
    return this.cfg.fishWidth * 0.46
  }

  /** Allowed range for the sprite centre, normalised. */
  bounds(): Rect {
    const hw = this.halfWidth()
    return { x0: hw + 0.02, x1: Math.max(hw + 0.03, 1 - hw - 0.02), y0: 0.2, y1: 0.7 }
  }

  private inflatedExclusion(): Rect | null {
    const e = this.cfg.exclusion
    if (!e) return null
    const hw = this.halfWidth()
    const hh = this.halfHeightN()
    return { x0: e.x0 - hw, x1: e.x1 + hw, y0: e.y0 - hh, y1: e.y1 + hh }
  }

  private pushOutOfExclusionX(x: number, margin = 0): number {
    const e = this.cfg.exclusion
    if (!e) return x
    const hw = this.halfWidth()
    const lo = e.x0 - hw + margin * 0
    const hi = e.x1 + hw
    if (x > lo && x < hi) {
      const b = this.bounds()
      const right = hi + margin
      const left = lo - margin
      if (right <= b.x1) return right
      if (left >= b.x0) return left
    }
    return x
  }

  /** Clamp a centre position into the bounds and out of the exclusion zone. */
  project(x: number, y: number): Vec {
    const b = this.bounds()
    let nx = clamp(x, b.x0, b.x1)
    let ny = clamp(y, b.y0, b.y1)
    const e = this.inflatedExclusion()
    if (e && nx > e.x0 && nx < e.x1 && ny > e.y0 && ny < e.y1) {
      const options: Array<{ x: number; y: number; d: number }> = []
      if (e.x1 <= b.x1) options.push({ x: e.x1, y: ny, d: e.x1 - nx })
      if (e.x0 >= b.x0) options.push({ x: e.x0, y: ny, d: nx - e.x0 })
      if (e.y0 >= b.y0) options.push({ x: nx, y: e.y0, d: ny - e.y0 })
      if (e.y1 <= b.y1) options.push({ x: nx, y: e.y1, d: e.y1 - ny })
      if (options.length > 0) {
        options.sort((a, c) => a.d - c.d)
        nx = options[0].x
        ny = options[0].y
      }
    }
    return { x: nx, y: ny }
  }

  private worldDx(x0: number, x1: number) {
    return x1 - x0
  }
  private worldDy(y0: number, y1: number) {
    return (y1 - y0) / this.cfg.aspect
  }

  // ---- noise ----

  private noise(t: number, channel: number) {
    const s = this.noiseSeed
    const a = s[channel % 4]
    return (
      (Math.sin(t * 0.37 + a) +
        Math.sin(t * 0.91 + a * 1.7) * 0.6 +
        Math.sin(t * 0.23 + a * 2.3) * 0.8) /
      2.4
    )
  }

  // ---- modes ----

  private pickWanderTarget() {
    const b = this.bounds()
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = lerp(b.x0, b.x1, this.rng())
      const y = lerp(b.y0, b.y1, (this.rng() + this.rng()) / 2)
      const p = this.project(x, y)
      const d = Math.hypot(this.worldDx(this.px, p.x), this.worldDy(this.py, p.y))
      if (d > 0.14 || attempt === 11) {
        this.target = p
        break
      }
    }
    this.targetTimer = 6 + this.rng() * 5
    this.pauseTimer = 0
  }

  private startInspect() {
    this.mode = 'inspect'
    this.inspectStage = 'in'
    this.inspectTimer = 0
    this.sinceInspect = 0
    const b = this.bounds()
    const e = this.inflatedExclusion()
    const cx = e ? (Math.max(b.x0, e.x1) + b.x1) / 2 : (b.x0 + b.x1) / 2
    this.target = this.project(cx, 0.46)
  }

  private resolveMode(): BettaMode {
    if (this.flareTimer > 0) return 'flare'
    if (this.ctx.mood === 'stressed') return 'sulk'
    if (this.mode === 'inspect') return 'inspect'
    if (this.pellets.some((p) => p.alpha > 0.5) && this.satisfiedTimer <= 0) return 'chase'
    if (this.ctx.night) return 'rest'
    if (this.focusPoint) return 'approach'
    return 'wander'
  }

  private enter(mode: BettaMode) {
    if (mode === 'wander') this.pickWanderTarget()
    if (mode === 'sulk') this.pickSulkTarget()
    if (mode === 'rest') this.target = this.project(this.cfg.restSpot.x, this.cfg.restSpot.y)
  }

  private pickSulkTarget() {
    const b = this.bounds()
    const p = this.project(lerp(b.x0, b.x1, 0.2 + this.rng() * 0.7), b.y1 - 0.02)
    this.target = p
    this.targetTimer = 12 + this.rng() * 8
  }

  // ---- main step ----

  step(dt: number): BettaFrame {
    let left = Math.min(dt, 0.25)
    while (left > 1e-6) {
      const h = Math.min(MAX_SUBSTEP, left)
      this.substep(h)
      left -= h
    }
    return this.frame()
  }

  private substep(dt: number) {
    this.time += dt
    this.idleTime += dt
    this.sinceInspect += dt
    this.sinceTurn += dt
    this.flareTimer = Math.max(0, this.flareTimer - dt)
    this.lookTimer = Math.max(0, this.lookTimer - dt)
    this.satisfiedTimer = Math.max(0, this.satisfiedTimer - dt)
    if (this.loopT >= 0) {
      this.loopT += dt
      if (this.loopT >= LOOP_SECONDS) this.loopT = -1
    }
    if (this.gulpT >= 0) {
      this.gulpT += dt
      if (this.gulpT >= GULP_SECONDS) this.gulpT = -1
    }

    this.stepPellets(dt)

    if (
      this.mode !== 'inspect' &&
      this.idleTime > IDLE_INSPECT_SECONDS &&
      this.sinceInspect > 240 &&
      this.ctx.mood !== 'stressed' &&
      !this.ctx.night
    ) {
      this.startInspect()
    }

    const next = this.resolveMode()
    if (next !== this.mode) {
      // Leaving inspect only happens through the 'out' stage below.
      this.mode = next
      this.enter(next)
    }

    const plan = this.plan(dt)
    this.integrate(dt, plan)
    this.animate(dt, plan)
  }

  private stepPellets(dt: number) {
    const b = this.bounds()
    for (const p of this.pellets) {
      p.age += dt
      const floor = b.y1 + 0.02
      if (p.y < floor) {
        p.y = Math.min(floor, p.y + 0.045 * this.cfg.aspect * dt)
      } else {
        p.alpha = Math.max(0, p.alpha - dt / 8)
      }
    }
    this.pellets = this.pellets.filter((p) => p.alpha > 0)
  }

  /** Per-mode plan: where to go, how fast, and how it should look. */
  private plan(dt: number) {
    const cruise = CRUISE_SPEED
    const t = this.time
    let goal: Vec | null = this.target
    let maxSpeed = cruise
    let faceDir: 1 | -1 | null = null
    let poseTarget = { cruise: 1, flare: 0, clamped: 0 }
    let fin = 0.75 + 0.1 * this.noise(t, 2)
    let tailScale = 1
    let zTarget = 0.5 + 0.05 * this.noise(t, 3)

    switch (this.mode) {
      case 'wander': {
        this.targetTimer -= dt
        const dist = Math.hypot(
          this.worldDx(this.px, this.target.x),
          this.worldDy(this.py, this.target.y),
        )
        if (this.pauseTimer > 0) {
          this.pauseTimer -= dt
          goal = null
          fin = 0.85
          if (this.pauseTimer <= 0) this.pickWanderTarget()
        } else if (dist < 0.02 || this.targetTimer <= 0) {
          if (this.rng() < 0.3) this.pauseTimer = 2 + this.rng() * 2.5
          else this.pickWanderTarget()
        }
        maxSpeed = cruise * (0.55 + 0.45 * (0.5 + 0.5 * this.noise(t * 0.6, 1)))
        break
      }
      case 'approach': {
        const fp = this.focusPoint
        if (!fp) break
        const stop = this.cfg.fishWidth * 0.62
        const side = sign(this.px - fp.x)
        goal = this.project(fp.x + side * stop, fp.y)
        faceDir = -side as 1 | -1
        maxSpeed = cruise * 1.1
        fin = 0.9
        break
      }
      case 'chase': {
        const pellet = this.nearestPellet()
        if (!pellet) break
        const face =
          Math.abs(pellet.x - this.px) > this.mouthOffset() * 0.4
            ? sign(pellet.x - this.px)
            : this.heading
        goal = this.project(pellet.x - face * this.mouthOffset(), pellet.y)
        faceDir = face
        maxSpeed = cruise * 1.5
        fin = 0.65
        const mouth = { x: this.px + this.heading * this.mouthOffset(), y: this.py }
        if (Math.hypot(this.worldDx(mouth.x, pellet.x), this.worldDy(mouth.y, pellet.y)) < 0.032) {
          this.pellets = this.pellets.filter((p) => p !== pellet)
          this.satisfiedTimer = 1.8
          this.gulpT = 0
          this.pauseTimer = 0
        }
        break
      }
      case 'flare': {
        goal = null
        poseTarget = { cruise: 0, flare: 1, clamped: 0 }
        fin = 1
        maxSpeed = 0
        tailScale = 1.5
        break
      }
      case 'rest': {
        this.target = this.project(this.cfg.restSpot.x, this.cfg.restSpot.y)
        goal = this.target
        maxSpeed = cruise * 0.35
        fin = 0.45
        tailScale = 0.25
        zTarget = 0.5
        const near =
          Math.hypot(this.worldDx(this.px, this.target.x), this.worldDy(this.py, this.target.y)) <
          0.03
        if (near) {
          goal = null
          faceDir = 1
        }
        break
      }
      case 'sulk': {
        this.targetTimer -= dt
        const dist = Math.hypot(
          this.worldDx(this.px, this.target.x),
          this.worldDy(this.py, this.target.y),
        )
        if (dist < 0.02 || this.targetTimer <= 0) this.pickSulkTarget()
        maxSpeed = cruise * 0.3
        poseTarget = { cruise: 0, flare: 0, clamped: 1 }
        fin = 0.12
        tailScale = 0.4
        zTarget = 0.46
        break
      }
      case 'inspect': {
        this.inspectTimer += dt
        zTarget = this.inspectStage === 'out' ? 0.5 : 0.86
        if (this.inspectStage === 'in') {
          maxSpeed = cruise * 0.8
          const d = Math.hypot(
            this.worldDx(this.px, this.target.x),
            this.worldDy(this.py, this.target.y),
          )
          if ((d < 0.03 && Math.abs(this.z - 0.86) < 0.05) || this.inspectTimer > 9) {
            this.inspectStage = 'stare'
            this.inspectTimer = 0
          }
        } else if (this.inspectStage === 'stare') {
          goal = null
          fin = 0.9
          if (this.inspectTimer > 3) {
            this.inspectStage = 'out'
            this.inspectTimer = 0
          }
        } else {
          goal = null
          if (this.inspectTimer > 2.2) {
            this.mode = 'wander'
            this.idleTime = 0
            this.enter('wander')
          }
        }
        break
      }
    }

    if (this.lookTimer > 0 && this.mode !== 'flare' && this.mode !== 'chase') {
      goal = null
      faceDir = this.lookDir
    }
    if (this.satisfiedTimer > 0 && this.mode !== 'chase') {
      goal = null
    }

    return { goal, maxSpeed, faceDir, poseTarget, fin, tailScale, zTarget }
  }

  private nearestPellet(): Pellet | null {
    let best: Pellet | null = null
    let bestD = Infinity
    for (const p of this.pellets) {
      if (p.alpha <= 0.5) continue
      const d = Math.hypot(this.worldDx(this.px, p.x), this.worldDy(this.py, p.y))
      if (d < bestD) {
        best = p
        bestD = d
      }
    }
    return best
  }

  private integrate(dt: number, plan: ReturnType<BettaSim['plan']>) {
    const { goal, maxSpeed, faceDir } = plan
    const speed = Math.hypot(this.vx, this.vy)

    // Decide which way the fish wants to face.
    let wantFace: 1 | -1 = this.heading
    if (faceDir !== null) {
      wantFace = faceDir
    } else if (goal) {
      const dx = this.worldDx(this.px, goal.x)
      if (Math.abs(dx) > 0.05) wantFace = sign(dx)
    }

    const turning = this.turnT >= 0
    if (!turning && wantFace !== this.heading && this.sinceTurn > 1.2) {
      this.turnT = 0
      this.heading = wantFace
    }
    if (this.turnT >= 0) {
      this.turnT += dt
      if (this.turnT >= TURN_SECONDS) {
        this.turnT = -1
        this.sinceTurn = 0
      }
    }
    const nowTurning = this.turnT >= 0
    if (this.turnT >= 0 && this.turnT / TURN_SECONDS >= 0.5) this.facing = this.heading

    // Desired velocity: head for the goal, arriving slowly, never backwards.
    let dvx = 0
    let dvy = 0
    if (goal && !nowTurning) {
      const dx = this.worldDx(this.px, goal.x)
      const dy = this.worldDy(this.py, goal.y)
      const dist = Math.hypot(dx, dy)
      const desired = Math.min(maxSpeed, dist * 0.55)
      if (dist > 1e-4) {
        dvx = (dx / dist) * desired
        dvy = (dy / dist) * desired
      }
      // Forward-only: cancel motion against the heading unless we are turning around.
      if (dvx * this.heading < 0) dvx = 0
      dvy = clamp(dvy, -0.03, 0.03)
    }
    // The old heading keeps drifting (and decays) through a turn.
    const accelMax = nowTurning ? 0.16 : 0.07
    const ax = clamp((dvx - this.vx) / Math.max(dt, 1e-4), -accelMax, accelMax)
    const ay = clamp((dvy - this.vy) / Math.max(dt, 1e-4), -accelMax, accelMax)
    this.vx += ax * dt
    this.vy += ay * dt
    if (!goal || nowTurning) {
      // Coast down gently (water drag).
      const drag = Math.exp(-(nowTurning ? 3.5 : 1.6) * dt)
      if (!goal) {
        this.vx *= drag
        this.vy *= drag
      }
    }
    const vmax = maxSpeed > 0 ? maxSpeed * 1.05 : speed
    const vmag = Math.hypot(this.vx, this.vy)
    if (vmag > Math.max(vmax, 0.02) && vmag > 0) {
      const k = Math.max(vmax, 0.02) / vmag
      this.vx *= k
      this.vy *= k
    }

    // Local acceleration for fin drag; smooth it so fins don't jitter.
    const localF = ax * this.heading
    this.accelF = approach(this.accelF, localF, 6, dt)
    this.accelU = approach(this.accelU, -ay, 6, dt)

    const nx = this.px + this.vx * dt
    const ny = this.py + this.vy * dt * this.cfg.aspect
    const p = this.project(nx, ny)
    if (p.x !== nx) this.vx = 0
    if (p.y !== ny) this.vy = 0
    this.px = p.x
    this.py = p.y

    // Bettas bob very slightly even when hovering.
    this.pitch = approach(
      this.pitch,
      clamp(Math.atan2(-this.vy, Math.abs(this.vx) + 0.02) * 0.7, -0.28, 0.28),
      3,
      dt,
    )

    this.prevAx = ax
    this.prevAy = ay
  }

  private animate(dt: number, plan: ReturnType<BettaSim['plan']>) {
    const speed = Math.hypot(this.vx, this.vy)
    const restful = this.mode === 'rest' || this.mode === 'sulk'
    const idle = Math.min(1, speed / CRUISE_SPEED)
    const tailHz = this.mode === 'flare' ? 2.1 : restful ? 0.45 + 0.5 * idle : 0.75 + 0.75 * idle
    this.tailPhase = (this.tailPhase + TAU * tailHz * dt * plan.tailScale ** 0.5) % (TAU * 64)
    const hovering = speed < 0.02 && this.mode !== 'rest'
    const pecHz = hovering ? 6.2 : this.mode === 'rest' ? 3.2 : 4.5 + 2 * idle
    this.pectoralPhase = (this.pectoralPhase + TAU * pecHz * dt) % (TAU * 64)
    this.breathPhase = (this.breathPhase + TAU * (restful ? 0.6 : 1.05) * dt) % (TAU * 64)

    const rate = 5
    this.pose.cruise = approach(this.pose.cruise, plan.poseTarget.cruise, rate, dt)
    this.pose.flare = approach(this.pose.flare, plan.poseTarget.flare, rate, dt)
    this.pose.clamped = approach(this.pose.clamped, plan.poseTarget.clamped, rate, dt)
    this.finSpread = approach(this.finSpread, plan.fin, 1.6, dt)
    this.zTarget = plan.zTarget
    this.z = approach(this.z, this.zTarget, 1.1, dt)
    const staring = this.mode === 'inspect' && this.inspectStage === 'stare' ? 1 : 0
    this.viewerFacing = approach(this.viewerFacing, staring, 1.8, dt)
  }

  frame(): BettaFrame {
    const turnProgress = this.turnT >= 0 ? clamp(this.turnT / TURN_SECONDS, 0, 1) : 0
    const total = this.pose.cruise + this.pose.flare + this.pose.clamped || 1
    // Loop: eased 0..2pi. The sprite pitches through a full turn while the body traces a small circle.
    let loopX = 0
    let loopY = 0
    let loopPitch = 0
    if (this.loopT >= 0) {
      const k = clamp(this.loopT / LOOP_SECONDS, 0, 1)
      const theta = Math.PI * 2 * (k * k * (3 - 2 * k))
      const r = this.cfg.fishWidth * 0.2
      loopX = this.heading * Math.sin(theta) * r
      loopY = -(1 - Math.cos(theta)) * r * this.cfg.aspect
      loopPitch = theta
    }
    const gulp = this.gulpT >= 0 ? Math.sin((Math.PI * this.gulpT) / GULP_SECONDS) : 0
    // Fins fold in while the pose crosses to clamped (and unfold on the way out).
    const clampedW = this.pose.clamped / total
    const fold = 1 - 0.8 * Math.sin(Math.PI * clamp(clampedW, 0, 1)) ** 2
    return {
      mode: this.mode,
      x: this.px + loopX,
      y: this.py + loopY,
      z: this.z,
      scale: 1 + (this.z - 0.5) * 0.9,
      heading: this.heading,
      facing: this.facing,
      speed: Math.hypot(this.vx, this.vy),
      turnProgress,
      pitch: this.pitch + loopPitch + gulp * 0.12,
      pose: {
        cruise: this.pose.cruise / total,
        flare: this.pose.flare / total,
        clamped: this.pose.clamped / total,
      },
      finSpread: this.finSpread * fold,
      tailBeatPhase: this.tailPhase,
      pectoralPhase: this.pectoralPhase,
      breathPhase: this.breathPhase,
      accel: { forward: this.accelF, up: this.accelU },
      viewerFacing: this.viewerFacing,
      gulp,
      pellets: this.pellets,
    }
  }
}
