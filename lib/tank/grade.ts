// Turns environment + water state into the colour-grade numbers the shaders use. Pure.

import type { Environment } from './environment'
import type { WaterState } from './waterState'

export type Grade = {
  exposure: number
  /** Multiplied into plate colour (colour temperature, season, holiday). */
  tint: [number, number, number]
  saturation: number
  /** Colour of the milky veil, before exposure. */
  hazeColor: [number, number, number]
  /** Strength of caustics and how blue-white they are. */
  causticGain: number
  causticTint: [number, number, number]
  shaftGain: number
  shaftTint: [number, number, number]
  moteTint: [number, number, number]
  /** 0 by day, 1 by night; used by bubbles and shrimp. */
  darkness: number
  /** Brightness of things drawn on top of the plate (props, foreground): 1 by day, about 0.3 at night. */
  ambient: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const mix3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const mul3 = (
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] => [a[0] * b[0], a[1] * b[1], a[2] * b[2]]

/** Approximate Kelvin to linear-ish RGB (Tanner Helland's fit), normalised so the max channel is 1. */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const c = (v: number) => clamp01(v / 255)
  return [c(r), c(g), c(b)]
}

// The colour temperature each plate was painted at, so grading only nudges away from it.
const PLATE_TEMP = { dawn: 4300, day: 5800, dusk: 3700, night: 9500 } as const
const PLATE_LIGHT = { dawn: 0.55, day: 0.95, dusk: 0.5, night: 0.12 } as const

const SEASON_TINT: Record<Environment['season'], [number, number, number]> = {
  spring: [0.98, 1.035, 0.985],
  summer: [1.015, 1.005, 0.98],
  autumn: [1.05, 1.0, 0.93],
  winter: [0.955, 0.995, 1.05],
}
const SEASON_SAT = { spring: 1.06, summer: 1.02, autumn: 1.0, winter: 0.93 } as const

export function computeGrade(env: Environment, water: WaterState): Grade {
  const ref = PLATE_TEMP[env.phase]
  const refRgb = kelvinToRgb(ref)
  const nowRgb = kelvinToRgb(env.light.colorTemp)
  const shift: [number, number, number] = [
    nowRgb[0] / refRgb[0],
    nowRgb[1] / refRgb[1],
    nowRgb[2] / refRgb[2],
  ]
  let tint = mix3([1, 1, 1], shift, 0.55)

  // Exposure follows the light level relative to how bright the plate already is.
  const rel = env.light.intensity / PLATE_LIGHT[env.phase]
  let exposure = clamp01(lerp(1, rel, 0.5) / 1.2) * 1.2
  exposure = Math.min(1.12, Math.max(0.72, exposure))

  const darkness = 1 - smoothstep(0.08, 0.6, env.light.intensity)
  const moonGain = 0.35 + 0.65 * env.moon.illumination
  if (env.phase === 'night') exposure *= 0.9 + 0.2 * env.moon.illumination

  tint = mul3(tint, SEASON_TINT[env.season])
  let saturation = SEASON_SAT[env.season]

  if (env.holiday === 'halloween' && darkness > 0.3) {
    tint = mul3(tint, mix3([1, 1, 1], [1.07, 1.0, 0.86], darkness))
  } else if (env.holiday === 'winter') {
    tint = mul3(tint, [0.98, 1.0, 1.03])
  }

  // Algae: green cast and a loss of clarity.
  tint = mul3(tint, mix3([1, 1, 1], [0.9, 1.03, 0.76], water.algae))
  saturation *= 1 - 0.12 * water.algae - 0.25 * water.haze

  const daylight = 1 - darkness
  const causticGain =
    (0.4 * daylight + 0.3 * darkness * moonGain) *
    (0.7 + 0.5 * water.sparkle) *
    (1 - 0.65 * water.haze)
  const causticTint = mix3([1.0, 0.93, 0.74], [0.5, 0.75, 1.0], darkness)
  const shaftGain =
    (0.34 * daylight + 0.2 * darkness * moonGain) *
    (0.65 + 0.55 * water.sparkle) *
    (1 - 0.5 * water.haze)
  const shaftTint = mix3([1.0, 0.92, 0.72], [0.45, 0.68, 0.95], darkness)
  const moteTint = mix3([1.0, 0.94, 0.8], [0.55, 0.75, 1.0], darkness)

  return {
    exposure,
    tint,
    saturation,
    hazeColor: mix3([0.55, 0.62, 0.52], [0.16, 0.24, 0.24], darkness),
    causticGain,
    causticTint,
    shaftGain,
    shaftTint,
    moteTint,
    darkness,
    ambient: 0.3 + 0.7 * smoothstep(0.05, 0.85, env.light.intensity),
  }
}
