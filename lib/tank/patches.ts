// Baked prop patches. Each prop (shrimp, bubble nest, leaf, algae) is a piece cut from a plate variant in
// which the image model painted the prop into the real plate, so light, focus and shadow already match.
// The renderer composites a patch over its plate in plate space. This module decides which patches are
// active and how opaque they are; it is pure so the rules can be tested without WebGL.

import patchData from '../../public/tank/patches.json'
import type { Phase, Season } from './environment'

export type PatchProp = 'shrimp' | 'nest' | 'leaf' | 'algae'

/** Slot order in the background shader: side * 4 + index. */
export const PATCH_PROPS: readonly PatchProp[] = ['shrimp', 'nest', 'leaf', 'algae']

export type PatchMeta = {
  prop: PatchProp
  phase: Phase
  /** Rectangle in plate uv [x0, y0, x1, y1], y down from the top of the plate image. */
  uv: [number, number, number, number]
  w: number
  h: number
}

const META = patchData as unknown as Record<string, PatchMeta>

export function patchKey(prop: PatchProp, phase: Phase): string {
  return `patch-${prop}-${phase}`
}

/** Metadata for a patch, or null when that prop has no patch in that phase (shrimp by day, algae at night). */
export function patchMeta(prop: PatchProp, phase: Phase): PatchMeta | null {
  return META[patchKey(prop, phase)] ?? null
}

/** Every patch file stem, for tests and asset checks. */
export function allPatchKeys(): string[] {
  return Object.keys(META)
}

export type PatchTargets = {
  /** Where the smoothed nest and leaf opacities are heading (0 or 1). */
  nest: number
  leaf: number
  /** Algae opacity, already eased: smoothstep of water.algae. */
  algae: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoothstep01 = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}

/** Target opacity of each prop for the current season and water. */
export function patchTargets(season: Season, bubbleNest: boolean, algae: number): PatchTargets {
  return {
    nest: bubbleNest ? 1 : 0,
    leaf: season === 'autumn' ? 1 : 0,
    algae: smoothstep01(algae),
  }
}

export type PatchSide = 'A' | 'B'

export type PatchLayer = {
  /** Which plate the patch is composited onto: A is the current plate, B the one fading in. */
  side: PatchSide
  prop: PatchProp
  phase: Phase
  key: string
  /** Opacity over its own plate. */
  opacity: number
  /** Opacity on screen: `opacity` times the plate's own weight in the crossfade. */
  weight: number
}

export type PatchInput = {
  phase: Phase
  /** The phase being crossfaded to, if any, and how far along (0..1, already eased). */
  fadeTo: Phase | null
  mix: number
  /** Current opacities of the props (nest and leaf are smoothed by the renderer). */
  opacities: PatchTargets
}

/**
 * The patches to draw. Each is composited onto its own plate before the plates are mixed, so a
 * patch crossfades with its plate for free: the shrimp exists only on the night plate and fades in as
 * night arrives, the nest and leaf change look with the phase, and an algae patch is dropped at night
 * (only the green grade remains there).
 */
export function patchLayers(input: PatchInput): PatchLayer[] {
  const out: PatchLayer[] = []
  const add = (side: PatchSide, phase: Phase, plateWeight: number) => {
    // Side B is listed from the start of the fade (weight 0) so its textures can load early.
    if (plateWeight <= 0 && side === 'A') return
    for (const prop of PATCH_PROPS) {
      const meta = patchMeta(prop, phase)
      if (!meta) continue
      // The shrimp is part of the night plate, so it needs no opacity of its own.
      const opacity = prop === 'shrimp' ? 1 : input.opacities[prop]
      if (opacity <= 0.001) continue
      out.push({
        side,
        prop,
        phase,
        key: patchKey(prop, phase),
        opacity,
        weight: opacity * plateWeight,
      })
    }
  }
  const b = input.fadeTo !== null ? clamp01(input.mix) : 0
  add('A', input.phase, 1 - b)
  if (input.fadeTo !== null) add('B', input.fadeTo, b)
  return out
}
