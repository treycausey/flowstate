// Behaviour and steering for the betta. Pure and deterministic: seeded RNG, injected dt, no DOM.
//
// Coordinates are normalised to the viewport: x and y in 0..1. Distances and speeds are measured in
// viewport widths (y is divided by the aspect ratio first), so 0.06 means 6% of the width per second
// in any direction. z is depth for focus: 0 far, 0.5 focal plane, 1 near the glass.

import type { Pellet, PelletField } from './pellets'
import { pushOut, type Avoid } from './creature'
import type { Mood } from './waterState'

export type { Pellet }

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

/** What makes one solitary fish differ from the betta (the honey gourami is calmer and never flares). */
export type SoloTraits = {
  /** Multiplies every swim speed. */
  speed: number
  flare: boolean
  /** Beds down at the rest spot at night. */
  rest: boolean
  inspect: boolean
}
const BETTA_TRAITS: SoloTraits = { speed: 1, flare: true, rest: true, inspect: true }

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

export const TURN_SECONDS = 1.0
export const CRUISE_SPEED = 0.03
export const IDLE_INSPECT_SECONDS = 120
export const LOOP_SECONDS = 1.1
const GULP_SECONDS = 0.4

/** Vertical band kept clear of the fish, as fractions of the viewport height. */
const SURFACE_BAND = 0.09
const SUBSTRATE_BAND = 0.12
/** Largest perspective scale a wandering fish reaches (z 0.65). */
const SCALE_WANDER_MAX = 1.12
const MIN_FIT = 0.6
/** Half extents of the drawn quad, in fish widths (renderer.ts: the betta mesh spans +-0.56 x +-0.46). */
const QUAD_HALF_W = 0.56
const QUAD_HALF_H = 0.46
/** Time to ease the fish into new bounds after the panel or viewport changes. */
const RECONFIGURE_SECONDS = 0.6
/** Chase eats a pellet when the mouth is this close, in viewport widths. */
const EAT_RADIUS = 0.024
/** A landed pellet rests this far below the lowest mouth position, in viewport widths (< EAT_RADIUS). */
const PELLET_FLOOR_GAP = 0.012
/** Mouth distance ahead of the sprite centre, in fish widths at scale 1. */
const MOUTH_REACH = 0.46
/** Lowest depth a wandering or chasing fish drifts to (wanderDepth bottoms out at 0.25). */
const Z_MIN = 0.25
/** Smallest swim range worth having, in viewport widths, before the fish shrinks. */
const MIN_RANGE_X = 0.06
const MIN_RANGE_Y = 0.04
/** Wander turns are events: at least this long after the last one finishes. */
const WANDER_TURN_GAP = 9.5
const SPEED_APPROACH = 0.042
const SPEED_CHASE = 0.065
const SPEED_INSPECT = 0.03
const SPEED_REST = 0.02
const SPEED_SULK = 0.02

const TAU = Math.PI * 2
const MAX_SUBSTEP = 1 / 60

/** Perspective scale for depth z: 0.75 far, 1 at the focal plane, 1.12 at z 0.65, ~1.29 at the glass. */
export function scaleForZ(z: number): number {
  return 1 + (z - 0.5) * (z < 0.5 ? 1 : 0.8)
}

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
  fishWidth: 0.19,
  exclusion: null,
  restSpot: { x: 0.74, y: 0.3 },
}

type Vec = { x: number; y: number }

/** A zero-height or not-yet-measured viewport yields aspect 0, NaN or Infinity: keep the last good value. */
function sanitizeConfig(next: BettaConfig, fallback: BettaConfig): BettaConfig {
  const good = (v: number) => Number.isFinite(v) && v > 0
  return {
    ...next,
    aspect: good(next.aspect) ? next.aspect : fallback.aspect,
    fishWidth: good(next.fishWidth) ? next.fishWidth : fallback.fishWidth,
  }
}

/** Swim volume derived from the config. */
type Geometry = {
  /** Largest free rectangle (viewport minus panel, surface band and substrate), normalised. */
  free: Rect
  /** Range for the sprite centre at the largest wander scale, normalised. */
  bounds: Rect
  /** Shrink factor (MIN_FIT..1) applied when the free rectangle is too small. */
  fit: number
}

/** A wander relocation: a quintic ease from the start with zero velocity and acceleration at the end. */
type Move = {
  sx: number
  sy: number
  /** Displacement in viewport widths. */
  dx: number
  dy: number
  dir: 1 | -1
  duration: number
  t: number
  v0x: number
  v0y: number
}

type WanderState = 'settle' | 'hover' | 'turn' | 'move'

/** The largest rectangle of open water: the viewport minus the panel, the surface band and the substrate. */
export function largestFreeRect(e: Rect | null): Rect {
  const top = SURFACE_BAND
  const bottom = 1 - SUBSTRATE_BAND
  let free: Rect = { x0: 0, y0: top, x1: 1, y1: bottom }
  if (e) {
    const c01 = (v: number) => clamp(v, 0, 1)
    const cy = (v: number) => clamp(v, top, bottom)
    const candidates: Rect[] = [
      { x0: c01(e.x1), y0: top, x1: 1, y1: bottom },
      { x0: 0, y0: top, x1: c01(e.x0), y1: bottom },
      { x0: 0, y0: top, x1: 1, y1: cy(e.y0) },
      { x0: 0, y0: cy(e.y1), x1: 1, y1: bottom },
    ]
    const area = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0)
    free = candidates.reduce((best, r) => (area(r) > area(best) ? r : best))
  }
  return free
}

const fallbackGeometry = (cfg: BettaConfig): Geometry => {
  const { aspect, fishWidth: fw, exclusion: e } = cfg
  const free = largestFreeRect(e)
  const freeW = free.x1 - free.x0
  const freeH = (free.y1 - free.y0) / aspect
  const marginX = Math.max(0.06 * freeW, 0.03)
  // Vertical margin comes from the free height: a short band must not lose its whole range to it.
  const marginY = Math.max(0.06 * freeH, 0.015)
  // Shrink the fish until it fits with room to move, but never below MIN_FIT.
  const fitX = (freeW - 2 * marginX - MIN_RANGE_X) / (2 * QUAD_HALF_W * fw * SCALE_WANDER_MAX)
  const fitY = (freeH - 2 * marginY - MIN_RANGE_Y) / (2 * QUAD_HALF_H * fw * SCALE_WANDER_MAX)
  const fit = clamp(Math.min(fitX, fitY), MIN_FIT, 1)
  const halfW = QUAD_HALF_W * fw * SCALE_WANDER_MAX * fit
  const halfH = QUAD_HALF_H * fw * SCALE_WANDER_MAX * fit
  // Too small even at MIN_FIT: the range collapses to its centre (the fish then only moves sideways).
  const span = (lo: number, hi: number) => (hi < lo ? [(lo + hi) / 2, (lo + hi) / 2] : [lo, hi])
  const [x0, x1] = span(free.x0 + marginX + halfW, free.x1 - marginX - halfW)
  const [y0, y1] = span(free.y0 + (marginY + halfH) * aspect, free.y1 - (marginY + halfH) * aspect)
  return { free, bounds: { x0, y0, x1, y1 }, fit }
}

export class BettaSim {
  private cfg: BettaConfig
  private geo: Geometry
  private rng: () => number
  private ctx: BettaContext = { night: false, mood: 'healthy' }

  /** Bounds and fit the fish is easing away from after a reconfigure (null when settled). */
  private easeFrom: { bounds: Rect; fit: number } | null = null
  private easeT = 0

  /** Times the hard clamp had to move the fish (should stay 0 in wander). */
  clampHits = 0

  // Kinematics. Position (px, py) is the swim anchor; velocity is in viewport widths per second.
  private px = 0.6
  private py = 0.42
  private vx = 0
  private vy = 0
  private z = 0.5
  private heading: 1 | -1 = 1
  private facing: 1 | -1 = 1
  private turnT = -1 // seconds into the current turn, -1 when not turning
  private sinceTurn = 99
  private accelF = 0
  private accelU = 0
  private pitch = 0
  /** Hover sway on top of the anchor, viewport widths. */
  private bobX = 0
  private bobY = 0
  private bobW = 1
  private outX = 0
  private outY = 0
  private outSpeed = 0

  private mode: BettaMode = 'wander'
  private time = 0
  private target: Vec = { x: 0.6, y: 0.42 }
  private targetTimer = 0
  private wander: {
    state: WanderState
    pauseLeft: number
    pauseTotal: number
    move: Move | null
    next: Move | null
  } = { state: 'settle', pauseLeft: 0, pauseTotal: 1, move: null, next: null }
  private flareTimer = 0
  private lookTimer = 0
  private lookDir: 1 | -1 = 1
  private satisfiedTimer = 0
  private idleTime = 0
  private sinceInspect = 240
  private inspectStage: 'in' | 'stare' | 'out' = 'in'
  private inspectTimer = 0
  private focusPoint: Vec | null = null
  private ownPellets: Pellet[] = []
  /** When set (the livestock shares one pellet field), the field owns, sinks and fades the pellets. */
  private shared: PelletField | null = null
  private traits: SoloTraits = BETTA_TRAITS
  private avoid: Avoid | null = null
  private nextPelletId = 1
  private noiseSeed: [number, number, number, number]

  private pose = { cruise: 1, flare: 0, clamped: 0 }
  private finSpread = 0.75
  private tailPhase = 0
  private pectoralPhase = 0
  private breathPhase = 0
  private viewerFacing = 0
  private loopT = -1
  private loopR = 0
  private gulpT = -1
  private zTarget = 0.5

  constructor(seed = 1, config: Partial<BettaConfig> = {}) {
    this.cfg = sanitizeConfig({ ...DEFAULT_CONFIG, ...config }, DEFAULT_CONFIG)
    this.geo = fallbackGeometry(this.cfg)
    this.rng = mulberry32(seed)
    this.noiseSeed = [this.rng() * TAU, this.rng() * TAU, this.rng() * TAU, this.rng() * TAU]
    const start = this.project(0.62, 0.42)
    this.px = start.x
    this.py = start.y
    this.target = { ...start }
    this.z = this.wanderDepth(0)
    this.zTarget = this.z
    this.updateBob(0, 0)
    this.outX = this.px + this.bobX
    this.outY = this.py + this.bobY * this.cfg.aspect
  }

  configure(partial: Partial<BettaConfig>) {
    this.cfg = sanitizeConfig({ ...this.cfg, ...partial }, this.cfg)
    const before = this.geo
    const shown = { bounds: this.easedBounds(), fit: this.easedFit() }
    this.geo = fallbackGeometry(this.cfg)
    const same =
      Math.abs(before.fit - this.geo.fit) < 1e-6 &&
      ['x0', 'y0', 'x1', 'y1'].every(
        (k) =>
          Math.abs(before.bounds[k as keyof Rect] - this.geo.bounds[k as keyof Rect]) < 1e-6 &&
          Math.abs(before.free[k as keyof Rect] - this.geo.free[k as keyof Rect]) < 1e-6,
      )
    if (same) return
    // Ease into the new bounds and size over RECONFIGURE_SECONDS instead of snapping in one frame.
    this.easeFrom = shown
    this.easeT = 0
    this.target = this.project(this.target.x, this.target.y)
    this.wander = { ...this.wander, state: 'settle', move: null, next: null }
  }

  setContext(ctx: BettaContext) {
    this.ctx = ctx
  }

  /** Use a pellet field shared with the rest of the livestock instead of the fish's own list. */
  usePelletField(field: PelletField | null) {
    this.shared = field
  }

  /** Keep clear of another fish's drawn ellipse (the gourami avoids the betta). */
  setAvoid(avoid: Avoid | null) {
    this.avoid = avoid
  }

  setTraits(traits: Partial<SoloTraits>) {
    this.traits = { ...BETTA_TRAITS, ...traits }
  }

  private get pellets(): Pellet[] {
    return this.shared ? this.shared.pellets : this.ownPellets
  }

  private removePellet(p: Pellet) {
    if (this.shared) this.shared.remove(p)
    else this.ownPellets = this.ownPellets.filter((q) => q !== p)
  }

  /** A pellet the fish can go for: not fading, and within reach of the lowest mouth position. */
  private edible(p: Pellet) {
    return p.alpha > 0.5 && p.y <= this.geo.bounds.y1 + (PELLET_FLOOR_GAP + 0.004) * this.cfg.aspect
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

  /** Where a pellet dropped for this fish starts (`at` is normalised; without it, just ahead of the fish). */
  pelletSpot(at?: Vec): Vec {
    this.activity()
    const reach = this.mouthOffset()
    // Just ahead of the fish, so the drop reads as "for the betta".
    const fallback = { x: this.px + this.heading * (reach + 0.05 + this.rng() * 0.05), y: 0.08 }
    const raw = at ?? fallback
    // The mouth tip only reaches [b.x0 - reach, b.x1 + reach]; a pellet outside that can never be eaten.
    // Use the shortest reach the fish has at any depth, so the range holds whatever z it drifts to.
    const b = this.geo.bounds
    const minReach = this.cfg.fishWidth * MOUTH_REACH * scaleForZ(Z_MIN) * this.geo.fit
    return {
      x: clamp(raw.x, b.x0 - minReach + 0.005, b.x1 + minReach - 0.005),
      y: clamp(raw.y, 0.03, 0.2),
    }
  }

  /** `at` is normalised; without it the pellet falls from near the surface at a random spot. */
  dropPellet(at?: Vec) {
    const spot = this.pelletSpot(at)
    this.ownPellets.push({ id: this.nextPelletId++, x: spot.x, y: spot.y, age: 0, alpha: 1 })
    if (this.ownPellets.length > 6) this.ownPellets.shift()
  }

  flare() {
    if (!this.traits.flare) return
    this.activity()
    this.flareTimer = 1.5 + this.rng()
  }

  /** The "betta" easter egg: a happy flare and one quick loop-the-loop. */
  celebrate() {
    if (!this.traits.flare) return
    this.activity()
    this.flareTimer = 2.2
    this.loopT = 0
    // Scale the loop to the room inside the free rect: it swings +-r sideways and 2r upward.
    const f = this.geo.free
    const hw = QUAD_HALF_W * this.cfg.fishWidth * this.drawnScale()
    const hh = QUAD_HALF_H * this.cfg.fishWidth * this.drawnScale()
    const aspect = this.cfg.aspect
    const roomSide = Math.min(this.outX - (f.x0 + hw), f.x1 - hw - this.outX)
    const roomUp = (this.outY - f.y0) / aspect - hh
    this.loopR = clamp(Math.min(this.cfg.fishWidth * 0.2, roomSide, roomUp / 2), 0, Infinity)
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
    if (!this.traits.inspect) return
    this.startInspect()
  }

  // ---- geometry ----

  /** 0..1 progress of the reconfigure ease (1 when settled). */
  private easeK() {
    if (!this.easeFrom) return 1
    const k = clamp(this.easeT / RECONFIGURE_SECONDS, 0, 1)
    return k * k * (3 - 2 * k)
  }

  private easedBounds(): Rect {
    const to = this.geo.bounds
    const from = this.easeFrom?.bounds
    if (!from) return to
    const k = this.easeK()
    return {
      x0: lerp(from.x0, to.x0, k),
      y0: lerp(from.y0, to.y0, k),
      x1: lerp(from.x1, to.x1, k),
      y1: lerp(from.y1, to.y1, k),
    }
  }

  private easedFit() {
    return this.easeFrom ? lerp(this.easeFrom.fit, this.geo.fit, this.easeK()) : this.geo.fit
  }

  /** Drawn scale now: perspective from depth times the fit-to-space shrink. */
  private drawnScale() {
    return scaleForZ(this.z) * this.easedFit()
  }

  /** Mouth distance ahead of the sprite centre, viewport widths. */
  /** Lowest y (normalised) a pellet can rest at and still be within reach of the mouth. */
  reachFloor() {
    return this.geo.bounds.y1 + PELLET_FLOOR_GAP * this.cfg.aspect
  }

  mouthOffset() {
    return this.cfg.fishWidth * MOUTH_REACH * this.drawnScale()
  }

  /** Allowed range for the sprite centre, normalised. */
  bounds(): Rect {
    return { ...this.geo.bounds }
  }

  /** Free rectangle the fish swims in (before insetting for its own size), normalised. */
  freeRect(): Rect {
    return { ...this.geo.free }
  }

  /** Shrink factor currently applied so the fish fits its space. */
  fit() {
    return this.geo.fit
  }

  /** Clamp a centre position into the swim bounds. */
  project(x: number, y: number): Vec {
    const b = this.easedBounds()
    return { x: clamp(x, b.x0, b.x1), y: clamp(y, b.y0, b.y1) }
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

  /** Slow depth drift: mostly 0.45-0.55, now and then out to 0.25 (far) or 0.65 (near). */
  private wanderDepth(t: number) {
    const s = this.noiseSeed
    const g = 0.6 * Math.sin(t * 0.05 + s[0]) + 0.4 * Math.sin(t * 0.031 + s[1])
    const c = g * g * g
    return c >= 0 ? 0.5 + 0.15 * c : 0.5 + 0.25 * c
  }

  private updateBob(t: number, dt: number) {
    const s = this.noiseSeed
    const w = this.mode === 'rest' || this.mode === 'sulk' ? 0.3 : 1
    this.bobW = dt > 0 ? approach(this.bobW, w, 1, dt) : w
    this.bobY =
      0.008 * this.bobW * (0.7 * Math.sin(t * 0.41 + s[2]) + 0.3 * Math.sin(t * 0.23 + s[3]))
    this.bobX = 0.003 * this.bobW * Math.sin(t * 0.29 + s[3])
  }

  // ---- modes ----

  /** Pick the next relocation, or null when nothing fits right now (hover a little longer). */
  private pickMove(): Move | null {
    const { bounds: b } = this.geo
    const aspect = this.cfg.aspect
    const rangeX = b.x1 - b.x0
    const inset = 0.004
    const canTurn = this.sinceTurn >= WANDER_TURN_GAP && this.turnT < 0
    const rare = this.rng() < 0.1
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const inCentre = (x: number, y: number) =>
      Math.abs(x - cx) <= 0.3 * (b.x1 - b.x0) + 1e-9 &&
      Math.abs(y - cy) <= 0.3 * (b.y1 - b.y0) + 1e-9
    const towardCentre = (x: number, y: number) =>
      Math.hypot(this.worldDx(x, cx), this.worldDy(y, cy)) <
      Math.hypot(this.worldDx(this.px, cx), this.worldDy(this.py, cy))
    for (let attempt = 0; attempt < 14; attempt++) {
      // Keep the heading most of the time; the turn is the exception.
      const wantOpposite = attempt >= 8 || this.rng() < 0.25
      if (wantOpposite && !canTurn) continue
      const dir: 1 | -1 = wantOpposite ? (-this.heading as 1 | -1) : this.heading
      const roomX = dir === 1 ? b.x1 - inset - this.px : this.px - (b.x0 + inset)
      let dist = rare ? lerp(0.14, 0.18, this.rng()) : lerp(0.06, 0.18, this.rng() ** 1.4)
      dist = Math.min(dist, roomX * 0.98, rangeX)
      if (dist < 0.05) continue
      // A collapsed vertical range (short band) still allows sideways moves: clamp, do not reject.
      const wantDy = (this.rng() * 2 - 1) * 0.35 * dist
      const yLo = Math.min(b.y0 + inset * aspect, (b.y0 + b.y1) / 2)
      const yHi = Math.max(b.y1 - inset * aspect, (b.y0 + b.y1) / 2)
      const ty = clamp(this.py + wantDy * aspect, yLo, yHi)
      const dyw = (ty - this.py) / aspect
      const dxw = dir * Math.sqrt(Math.max(0, dist * dist - dyw * dyw))
      const tx = this.px + dxw
      if (!inCentre(tx, ty) && !towardCentre(tx, ty) && this.rng() > 0.15) continue
      const length = Math.hypot(dxw, dyw)
      // Cap peak speed so the ease-in never exceeds a gentle acceleration, even on short hops.
      const aCap = rare ? 0.02 : 0.012
      const peak =
        Math.min(
          rare ? lerp(0.033, 0.04, this.rng()) : lerp(0.012, 0.026, this.rng()),
          Math.sqrt((aCap * length) / 1.64),
        ) * this.traits.speed
      return {
        sx: this.px,
        sy: this.py,
        dx: dxw,
        dy: dyw,
        dir,
        duration: (1.875 * length) / peak,
        t: 0,
        v0x: this.vx,
        v0y: this.vy,
      }
    }
    return null
  }

  private startPause(min: number, max: number) {
    const pause = lerp(min, max, this.rng())
    this.wander.pauseLeft = pause
    this.wander.pauseTotal = pause
    this.wander.state = 'hover'
  }

  private startInspect() {
    this.mode = 'inspect'
    this.inspectStage = 'in'
    this.inspectTimer = 0
    this.sinceInspect = 0
    const f = this.geo.free
    this.target = this.project((f.x0 + f.x1) / 2, 0.46)
  }

  private resolveMode(): BettaMode {
    if (this.flareTimer > 0) return 'flare'
    if (this.ctx.mood === 'stressed') return 'sulk'
    if (this.mode === 'inspect') return 'inspect'
    if (this.pellets.some((p) => this.edible(p)) && this.satisfiedTimer <= 0) return 'chase'
    if (this.ctx.night && this.traits.rest) return 'rest'
    if (this.focusPoint) return 'approach'
    return 'wander'
  }

  private enter(mode: BettaMode) {
    if (mode === 'wander') {
      this.wander = { ...this.wander, state: 'settle', move: null, next: null }
    }
    if (mode === 'sulk') this.pickSulkTarget()
    if (mode === 'rest') this.target = this.project(this.cfg.restSpot.x, this.cfg.restSpot.y)
  }

  private pickSulkTarget() {
    const b = this.geo.bounds
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

    if (this.easeFrom) {
      this.easeT += dt
      if (this.easeT >= RECONFIGURE_SECONDS) this.easeFrom = null
    }

    this.stepPellets(dt)

    if (
      this.mode !== 'inspect' &&
      this.idleTime > IDLE_INSPECT_SECONDS &&
      this.sinceInspect > 240 &&
      this.ctx.mood !== 'stressed' &&
      this.traits.inspect &&
      !this.ctx.night
    ) {
      this.startInspect()
    }

    const next = this.resolveMode()
    if (next !== this.mode) {
      // Inspect is left only from plan() (its 'out' stage sets mode back to wander), never here.
      this.mode = next
      this.enter(next)
    }

    const plan = this.plan(dt)
    this.integrate(dt, plan)
    this.animate(dt, plan)
  }

  private stepPellets(dt: number) {
    if (this.shared) return
    const b = this.geo.bounds
    for (const p of this.pellets) {
      p.age += dt
      // Rests within the mouth's reach of the lowest fish position (normalised y scales with aspect).
      const floor = b.y1 + PELLET_FLOOR_GAP * this.cfg.aspect
      if (p.y < floor) {
        p.y = Math.min(floor, p.y + 0.045 * this.cfg.aspect * dt)
      } else {
        p.alpha = Math.max(0, p.alpha - dt / 8)
      }
    }
    this.ownPellets = this.ownPellets.filter((p) => p.alpha > 0)
  }

  /** Per-mode plan: where to go, how fast, and how it should look. */
  private plan(dt: number) {
    const t = this.time
    let goal: Vec | null = this.target
    let maxSpeed = CRUISE_SPEED
    let accelMax = 0.03
    let faceDir: 1 | -1 | null = null
    let follow = false
    let hoverV: Vec = { x: 0, y: 0 }
    let maxVy = 0.02
    let reverse = false
    let poseTarget = { cruise: 1, flare: 0, clamped: 0 }
    let fin = 0.75 + 0.1 * this.noise(t, 2)
    let tailScale = 1
    let zTarget = this.wanderDepth(t)
    let zRate = 0.3

    switch (this.mode) {
      case 'wander': {
        goal = null
        const w = this.wander
        fin = 0.8 + 0.12 * this.noise(t * 0.5, 2)
        if (this.lookTimer > 0) {
          // A tap elsewhere: stop drifting, turn to look.
          if (w.state === 'move' || w.state === 'turn') {
            w.state = 'settle'
            w.move = null
            w.next = null
          }
          break
        }
        if (w.state === 'settle') {
          if (Math.hypot(this.vx, this.vy) < 0.004) this.startPause(1, 4)
        } else if (w.state === 'hover') {
          w.pauseLeft -= dt
          const phase = clamp(1 - w.pauseLeft / w.pauseTotal, 0, 1)
          // Barely-there drift along the heading, easing in and out of the pause.
          // It fades out before the bound, so a hover never pushes the fish into the clamp.
          const b = this.geo.bounds
          const room = this.heading === 1 ? b.x1 - this.px : this.px - b.x0
          const near = clamp((room - 0.006) / 0.03, 0, 1)
          hoverV = { x: this.heading * 0.0015 * Math.sin(Math.PI * phase) ** 2 * near, y: 0 }
          if (w.pauseLeft <= 0) {
            const move = this.pickMove()
            if (!move) {
              this.startPause(1, 2)
            } else {
              w.next = move
              if (move.dir !== this.heading) w.state = 'turn'
              else this.beginMove()
            }
          }
        }
        if (w.state === 'turn' && w.next) {
          faceDir = w.next.dir
          if (this.turnT < 0 && this.heading === w.next.dir) this.beginMove()
        }
        if (w.state === 'move') follow = true
        break
      }
      case 'approach': {
        const fp = this.focusPoint
        if (!fp) break
        const stop = this.cfg.fishWidth * 0.62
        const side = sign(this.px - fp.x)
        goal = this.project(fp.x + side * stop, fp.y)
        faceDir = -side as 1 | -1
        maxSpeed = SPEED_APPROACH
        fin = 0.9
        break
      }
      case 'chase': {
        const pellet = this.nearestPellet()
        if (!pellet) break
        const mouth = this.mouthOffset()
        // Positive when the pellet is ahead of the sprite centre. Only a pellet clearly behind
        // the fish makes it turn; one just behind the mouth is reached by backing up a little.
        const ahead = (pellet.x - this.px) * this.heading
        const face: 1 | -1 = ahead < -mouth * 0.15 ? (-this.heading as 1 | -1) : this.heading
        goal = this.project(pellet.x - face * mouth, pellet.y)
        faceDir = face
        maxSpeed = SPEED_CHASE
        accelMax = 0.06
        maxVy = 0.06
        reverse = ahead > -mouth * 0.15 && ahead < mouth * 1.2
        fin = 0.65
        const tip = { x: this.px + this.heading * mouth, y: this.py }
        if (Math.hypot(this.worldDx(tip.x, pellet.x), this.worldDy(tip.y, pellet.y)) < EAT_RADIUS) {
          this.removePellet(pellet)
          this.satisfiedTimer = 1.8
          this.gulpT = 0
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
        maxSpeed = SPEED_REST
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
        maxSpeed = SPEED_SULK
        poseTarget = { cruise: 0, flare: 0, clamped: 1 }
        fin = 0.12
        tailScale = 0.4
        zTarget = 0.46
        break
      }
      case 'inspect': {
        this.inspectTimer += dt
        zTarget = this.inspectStage === 'out' ? 0.5 : 0.86
        zRate = 1.1
        if (this.inspectStage === 'in') {
          maxSpeed = SPEED_INSPECT
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
      follow = false
      faceDir = this.lookDir
    }
    if (this.satisfiedTimer > 0 && this.mode !== 'chase') {
      goal = null
    }

    return {
      goal,
      maxSpeed,
      accelMax,
      maxVy,
      reverse,
      faceDir,
      follow,
      hoverV,
      poseTarget,
      fin,
      tailScale,
      zTarget,
      zRate,
    }
  }

  private beginMove() {
    const w = this.wander
    if (!w.next) return
    const m = w.next
    m.sx = this.px
    m.sy = this.py
    m.v0x = this.vx
    m.v0y = this.vy
    m.t = 0
    w.move = m
    w.next = null
    w.state = 'move'
  }

  private nearestPellet(): Pellet | null {
    let best: Pellet | null = null
    let bestD = Infinity
    for (const p of this.pellets) {
      if (!this.edible(p)) continue
      const d = Math.hypot(this.worldDx(this.px, p.x), this.worldDy(this.py, p.y))
      if (d < bestD) {
        best = p
        bestD = d
      }
    }
    return best
  }

  private integrate(dt: number, plan: ReturnType<BettaSim['plan']>) {
    const { goal, maxSpeed, accelMax, faceDir } = plan
    const aspect = this.cfg.aspect
    const vpx = this.vx
    const vpy = this.vy

    // Decide which way the fish wants to face.
    let wantFace: 1 | -1 = this.heading
    if (faceDir !== null) {
      wantFace = faceDir
    } else if (goal) {
      const dx = this.worldDx(this.px, goal.x)
      if (Math.abs(dx) > 0.05) wantFace = sign(dx)
    }

    const turnGap = this.mode === 'wander' && this.lookTimer <= 0 ? WANDER_TURN_GAP - 0.5 : 1.2
    if (this.turnT < 0 && wantFace !== this.heading && this.sinceTurn > turnGap) {
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

    const move = plan.follow ? this.wander.move : null
    if (move) {
      move.t += dt
      const tau = clamp(move.t / move.duration, 0, 1)
      const tau2 = tau * tau
      const tau3 = tau2 * tau
      const h10 = tau - 6 * tau3 + 8 * tau3 * tau - 3 * tau3 * tau2
      const h01 = 10 * tau3 - 15 * tau3 * tau + 6 * tau3 * tau2
      const d10 = 1 - 18 * tau2 + 32 * tau3 - 15 * tau3 * tau
      const d01 = 30 * tau2 - 60 * tau3 + 30 * tau3 * tau
      const px = move.sx + move.v0x * move.duration * h10 + move.dx * h01
      const py = move.sy + (move.v0y * move.duration * h10 + move.dy * h01) * aspect
      this.vx = move.v0x * d10 + (move.dx * d01) / move.duration
      this.vy = move.v0y * d10 + (move.dy * d01) / move.duration
      this.applyPosition(px, py)
      if (move.t >= move.duration) {
        this.vx = 0
        this.vy = 0
        this.wander.move = null
        this.startPause(4, 14)
      }
    } else {
      if (goal) {
        // Desired velocity: head for the goal, arriving slowly, never backwards.
        let dvx = 0
        let dvy = 0
        if (!nowTurning) {
          const dx = this.worldDx(this.px, goal.x)
          const dy = this.worldDy(this.py, goal.y)
          const dist = Math.hypot(dx, dy)
          const desired = Math.min(maxSpeed, dist * 0.55)
          if (dist > 1e-4) {
            dvx = (dx / dist) * desired
            dvy = (dy / dist) * desired
          }
          // Never backwards, except a short back-up to a pellet just behind the mouth.
          if (dvx * this.heading < 0) dvx = plan.reverse ? clamp(dvx, -0.03, 0.03) : 0
          dvy = clamp(dvy, -plan.maxVy, plan.maxVy)
        }
        const ax = clamp((dvx - this.vx) / Math.max(dt, 1e-4), -accelMax, accelMax)
        const ay = clamp((dvy - this.vy) / Math.max(dt, 1e-4), -accelMax, accelMax)
        this.vx += ax * dt
        this.vy += ay * dt
        const vmax = Math.max(maxSpeed * 1.05, 0.02)
        const vmag = Math.hypot(this.vx, this.vy)
        if (vmag > vmax) {
          this.vx *= vmax / vmag
          this.vy *= vmax / vmag
        }
      } else {
        // No goal: water drag brings the fish to a soft stop (or to the hover drift).
        this.vx = approach(this.vx, plan.hoverV.x, 1.6, dt)
        this.vy = approach(this.vy, plan.hoverV.y, 1.6, dt)
      }
      this.applyPosition(this.px + this.vx * dt, this.py + this.vy * dt * aspect)
    }

    // Fin drag follows the acceleration; smooth it so fins don't jitter.
    const localF = ((this.vx - vpx) / Math.max(dt, 1e-4)) * this.heading
    const localU = -((this.vy - vpy) / Math.max(dt, 1e-4))
    this.accelF = approach(this.accelF, localF, 6, dt)
    this.accelU = approach(this.accelU, localU, 6, dt)

    this.updateBob(this.time, dt)
    const ox = this.px + this.bobX
    const oy = this.py + this.bobY * aspect
    this.outSpeed = Math.hypot(ox - this.outX, (oy - this.outY) / aspect) / Math.max(dt, 1e-4)
    this.outX = ox
    this.outY = oy

    // Bettas bob very slightly even when hovering.
    this.pitch = approach(
      this.pitch,
      clamp(Math.atan2(-this.vy, Math.abs(this.vx) + 0.02) * 0.7, -0.28, 0.28),
      3,
      dt,
    )
  }

  /** Move the anchor; the hard clamp is a safety net and is counted when it fires. */
  private applyPosition(nx: number, ny: number) {
    const av = this.avoid
    if (av && Math.abs(this.z - av.z) < 0.1) {
      const w = this.cfg.fishWidth * this.drawnScale()
      const [ax, ay] = pushOut(
        nx,
        ny / this.cfg.aspect,
        av,
        0.5 * w + 0.3 * this.cfg.fishWidth,
        0.3 * w + 0.2 * this.cfg.fishWidth,
      )
      nx = ax
      ny = ay * this.cfg.aspect
    }
    const p = this.project(nx, ny)
    if (!this.easeFrom && (Math.abs(p.x - nx) > 1e-9 || Math.abs(p.y - ny) > 1e-9)) this.clampHits++
    if (p.x !== nx) this.vx = 0
    if (p.y !== ny) this.vy = 0
    this.px = p.x
    this.py = p.y
  }

  private animate(dt: number, plan: ReturnType<BettaSim['plan']>) {
    const speed = this.outSpeed
    const restful = this.mode === 'rest' || this.mode === 'sulk'
    const idle = Math.min(1, speed / CRUISE_SPEED)
    const tailHz = this.mode === 'flare' ? 2.1 : restful ? 0.45 + 0.5 * idle : 0.7 + 0.8 * idle
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
    this.z = approach(this.z, this.zTarget, plan.zRate, dt)
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
      const r = this.loopR
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
      x: this.outX + loopX,
      y: this.outY + loopY,
      z: this.z,
      scale: this.drawnScale(),
      heading: this.heading,
      facing: this.facing,
      speed: this.outSpeed,
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
