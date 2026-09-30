// Shared types for the livestock simulations (everything that is not the betta's own sim).

import type { Rect } from './betta'
import type { SpeciesProfile } from './species'
import type { Mood } from './waterState'

/** One creature, ready to draw. Coordinates are normalised to the viewport, like the betta's. */
export type CreatureFrame = {
  /** Stable across frames. */
  key: string
  species: string
  x: number
  y: number
  z: number
  /** Perspective scale (1 at the focal plane). */
  scale: number
  /** Sprite width multiplier for the creature's own size on top of `scale` (1 unless fitted). */
  fit: number
  heading: 1 | -1
  facing: 1 | -1
  /** 0 when not turning, otherwise 0..1 through the turn. */
  turnProgress: number
  /** Nose-up angle in radians. */
  pitch: number
  /** Swim speed in viewport widths per second. */
  speed: number
  tailPhase: number
  pecPhase: number
  /** Body-wave strength, 0..1.4 (1 is cruise). */
  wave: number
  /** 0..1 pulse right after it eats. */
  gulp: number
  alpha: number
  /** The creature lives on the plate and moves with its parallax (shrimp, snails, otos). */
  plateSpace: boolean
  /** The substrate contact shadow is drawn. */
  shadow: boolean
  /** Fine detail is softened to the plate's sharpness. */
  soft: boolean
}

export type World = {
  aspect: number
  /** The betta sprite width in view widths; every size derives from it. */
  fishWidth: number
  exclusion: Rect | null
  /** Open water (from `largestFreeRect`). */
  free: Rect
  /** Normalised y of the substrate line creatures stand on. */
  floorY: number
  /** Plate uv to normalised view coordinates. */
  plateToView: (u: number, v: number) => [number, number]
}

export type StockContext = { night: boolean; dusk: boolean; mood: Mood }

export interface Group {
  readonly profile: SpeciesProfile
  configure(world: World): void
  setContext(ctx: StockContext): void
  step(dt: number): void
  frames(): CreatureFrame[]
  /** Fewer drawn (frame budget). Count never drops below 1. */
  setVisible(n: number): void
  /** Keep clear of the betta (schools only). */
  setAvoid?(avoid: Avoid | null): void
}

export const TAU = Math.PI * 2
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))
export const sign = (v: number): 1 | -1 => (v < 0 ? -1 : 1)
export const smooth = (t: number) => {
  const k = clamp(t, 0, 1)
  return k * k * (3 - 2 * k)
}

/** Largest x-range (normalised) of a horizontal band y0..y1 that the panel does not cover. */
export function bandInterval(world: World, y0: number, y1: number): [number, number] {
  const e = world.exclusion
  if (!e || e.y1 <= y0 || e.y0 >= y1) return [0, 1]
  const left: [number, number] = [0, clamp(e.x0, 0, 1)]
  const right: [number, number] = [clamp(e.x1, 0, 1), 1]
  return left[1] - left[0] >= right[1] - right[0] ? left : right
}

/** True when a rect (normalised) overlaps the panel. */
export function overlapsPanel(world: World, x: number, y: number, hw: number, hhNorm: number) {
  const e = world.exclusion
  if (!e) return false
  return x + hw > e.x0 && x - hw < e.x1 && y + hhNorm > e.y0 && y - hhNorm < e.y1
}

/** An obstacle the swimmers keep clear of (the betta's drawn ellipse). World units: y is normalised y over the aspect. */
export type Avoid = { x: number; y: number; rx: number; ry: number; z: number }

/** Ellipse metric: below 1 the point is inside the obstacle grown by (mx, my). */
export function ellipseE(x: number, y: number, a: Avoid, mx: number, my: number) {
  return Math.hypot((x - a.x) / (a.rx + mx), (y - a.y) / (a.ry + my))
}

/** The nearest point on the grown ellipse when (x, y) is inside it, otherwise the point itself. */
export function pushOut(x: number, y: number, a: Avoid, mx: number, my: number): [number, number] {
  const e = ellipseE(x, y, a, mx, my)
  if (e >= 1) return [x, y]
  if (e < 1e-6) return [a.x + a.rx + mx, a.y]
  return [a.x + (x - a.x) / e, a.y + (y - a.y) / e]
}
