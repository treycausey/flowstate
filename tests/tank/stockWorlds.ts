import { largestFreeRect, type Rect } from '@/lib/tank/betta'
import type { World } from '@/lib/tank/creature'

type Def = { fw: number; aspect: number; exclusion: Rect }

/** Desktop 1440x900: the panel is a full-height column on the left. */
const DESKTOP: Def = { fw: 0.19, aspect: 1.6, exclusion: { x0: 0.01, y0: 0, x1: 0.33, y1: 1 } }
/** Phone 375x812: the sheet covers everything below 34% of the height. */
const PHONE: Def = { fw: 0.34, aspect: 0.46, exclusion: { x0: 0, y0: 0.34, x1: 1, y1: 2 } }
/** Landscape phone 844x390. */
const LANDSCAPE: Def = {
  fw: 0.212,
  aspect: 844 / 390,
  exclusion: { x0: 0, y0: 0.34, x1: 1, y1: 2 },
}
/** Desktop with no panel (Stock tab closed). */
const OPEN: Def = { fw: 0.19, aspect: 1.6, exclusion: { x0: 0, y0: 0, x1: 0, y1: 0 } }

/** Plate uv to view: the plate is cropped like the renderer does at this aspect, centred. */
function plateMap(aspect: number) {
  const PLATE = 2560 / 1707
  const crop = 0.975
  const span: [number, number] =
    aspect > PLATE ? [crop, (crop * PLATE) / aspect] : [(crop * aspect) / PLATE, crop]
  const c: [number, number] = [
    Math.min(Math.max(aspect < 1.2 ? 0.72 : 0.5, span[0] / 2), 1 - span[0] / 2),
    Math.min(Math.max(aspect < 1.2 ? 0.5 : 0.46, span[1] / 2), 1 - span[1] / 2),
  ]
  return (u: number, v: number): [number, number] => [
    (u - c[0]) / span[0] + 0.5,
    (v - c[1]) / span[1] + 0.5,
  ]
}

export function makeWorld(d: Def): World {
  const ex = d.exclusion.x1 > d.exclusion.x0 ? d.exclusion : null
  const map = plateMap(d.aspect)
  return {
    aspect: d.aspect,
    fishWidth: d.fw,
    exclusion: ex,
    free: largestFreeRect(ex),
    floorY: Math.min(0.93, map(0.5, 0.92)[1]),
    plateToView: map,
  }
}

export const WORLDS = [
  ['desktop', makeWorld(DESKTOP)],
  ['phone', makeWorld(PHONE)],
  ['landscape', makeWorld(LANDSCAPE)],
  ['open tank', makeWorld(OPEN)],
] as const

export const LONG = process.env.STOCK_LONG === '1'
export const SEEDS = LONG ? [1, 2, 3, 4, 5] : [1, 2]
export const MINUTES = LONG ? 10 : 4
