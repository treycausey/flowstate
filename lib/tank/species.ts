// Livestock profiles for the living tank: on-screen size, motion model and swim style. Pure data.
//
// Sizes are the real adult length (body plus tail, cm) of each cut-out. The betta is the reference:
// about 6 cm at the betta sprite width, so any creature is `lengthCm / 6` of the betta width at the
// focal plane. Speeds are in body lengths per second, so a fish looks the same on a phone and a desktop.

// One stock type for the app: the Stock feature's kinds, zones and scene entry are the tank's too.
import type { TankStockEntry } from '@/lib/stock/forTank'
import type { StockKind, StockZone } from '@/lib/stock/types'

export type { StockKind, StockZone }
export type MotionModel = 'solitary' | 'school' | 'bottom' | 'kuhli' | 'grazer' | 'crawler'

/** One line of recorded stock, as `stockForTank` produces it. */
export type StockEntry = TankStockEntry

export type SpeciesProfile = {
  id: string
  model: MotionModel
  kind: StockKind
  lengthCm: number
  /** Sprite height over width. */
  ratio: number
  /** Calm cruise speed, body lengths per second. */
  cruiseBl: number
  /** Tail-beat frequency at cruise, Hz. */
  tailHz: number
  /** Peak body-wave amplitude at the tail, in sprite widths. */
  wave: number
  /** Phase lag of the wave from nose to tail, radians. */
  waveLag: number
  /** Fraction of the body from the nose that stays rigid. */
  headRigid: number
  /** Fins and tail flow in the water (betta, guppy, gourami) instead of staying rigid. */
  flows: boolean
  /** Pectoral fins flutter. */
  pectoral: boolean
  /** Average spacing between school mates, in body lengths. */
  spacing: number
  /** Most of this species drawn at once. */
  maxRender: number
  /** The substrate contact shadow is always drawn (corys, shrimp, snails). */
  grounded: boolean
}

export const BETTA_LENGTH_CM = 6
export const BETTA_RATIO = 879 / 1200

const fish = (
  id: string,
  model: MotionModel,
  lengthCm: number,
  ratio: number,
  o: Partial<SpeciesProfile> = {},
): SpeciesProfile => ({
  id,
  model,
  kind: 'fish',
  lengthCm,
  ratio,
  cruiseBl: 0.3,
  tailHz: 2.4,
  wave: 0.04,
  waveLag: 5,
  headRigid: 0.3,
  flows: false,
  pectoral: true,
  spacing: 1.3,
  maxRender: 12,
  grounded: false,
  ...o,
})

const school = (id: string, cm: number, ratio: number, o: Partial<SpeciesProfile> = {}) =>
  fish(id, 'school', cm, ratio, o)

const crawler = (
  id: string,
  kind: 'shrimp' | 'snail',
  cm: number,
  ratio: number,
  o: Partial<SpeciesProfile> = {},
): SpeciesProfile =>
  fish(id, 'crawler', cm, ratio, {
    kind,
    cruiseBl: kind === 'shrimp' ? 0.35 : 0.035,
    tailHz: 0,
    wave: 0,
    pectoral: false,
    grounded: true,
    maxRender: kind === 'shrimp' ? 8 : 4,
    ...o,
  })

export const SPECIES: Record<string, SpeciesProfile> = {
  'neon-tetra': school('neon-tetra', 2.7, 298 / 720, { spacing: 0.95 }),
  'cardinal-tetra': school('cardinal-tetra', 3.8, 297 / 720),
  'ember-tetra': school('ember-tetra', 2.0, 319 / 720, { spacing: 1.2 }),
  'rummy-nose-tetra': school('rummy-nose-tetra', 3.5, 288 / 720, { spacing: 1.1, cruiseBl: 0.26 }),
  'harlequin-rasbora': school('harlequin-rasbora', 3.8, 359 / 720, { cruiseBl: 0.26 }),
  'chili-rasbora': school('chili-rasbora', 1.8, 286 / 720, { spacing: 1.2, wave: 0.045 }),
  'celestial-pearl-danio': school('celestial-pearl-danio', 2.4, 296 / 720, {
    spacing: 1.6,
    cruiseBl: 0.22,
  }),
  guppy: school('guppy', 3.6, 396 / 720, {
    flows: true,
    spacing: 1.8,
    cruiseBl: 0.22,
    maxRender: 8,
  }),
  endler: school('endler', 2.8, 246 / 720, { flows: true, spacing: 1.6, cruiseBl: 0.26 }),
  platy: school('platy', 4.5, 401 / 720, { spacing: 1.8, cruiseBl: 0.22, maxRender: 8 }),
  'honey-gourami': fish('honey-gourami', 'solitary', 4.0, 393 / 720, {
    flows: true,
    cruiseBl: 0.2,
    tailHz: 1.6,
    maxRender: 1,
  }),
  'panda-corydoras': fish('panda-corydoras', 'bottom', 3.5, 365 / 720, {
    cruiseBl: 0.3,
    wave: 0.02,
    grounded: true,
    maxRender: 6,
    spacing: 2.4,
  }),
  'bronze-corydoras': fish('bronze-corydoras', 'bottom', 4.2, 334 / 720, {
    cruiseBl: 0.3,
    wave: 0.02,
    grounded: true,
    maxRender: 6,
    spacing: 2.4,
  }),
  'pygmy-corydoras': fish('pygmy-corydoras', 'bottom', 2.0, 319 / 720, {
    cruiseBl: 0.36,
    wave: 0.025,
    grounded: true,
    maxRender: 6,
    spacing: 2.2,
  }),
  otocinclus: fish('otocinclus', 'grazer', 3.0, 249 / 720, {
    cruiseBl: 0.1,
    wave: 0.015,
    grounded: true,
    maxRender: 4,
  }),
  'kuhli-loach': fish('kuhli-loach', 'kuhli', 8.5, 118 / 720, {
    cruiseBl: 0.16,
    tailHz: 1.1,
    wave: 0.09,
    waveLag: 11,
    headRigid: 0,
    pectoral: false,
    grounded: true,
    maxRender: 3,
  }),
  'cherry-shrimp': crawler('cherry-shrimp', 'shrimp', 2.5, 423 / 720),
  'amano-shrimp': crawler('amano-shrimp', 'shrimp', 3.5, 393 / 720),
  'nerite-snail': crawler('nerite-snail', 'snail', 2.0, 413 / 720),
  'mystery-snail': crawler('mystery-snail', 'snail', 4.5, 392 / 720),
  'ramshorn-snail': crawler('ramshorn-snail', 'snail', 2.2, 418 / 720),
}

export const BETTA_ID = 'betta'

/** Stand-ins for stock whose species is unknown, picked by kind and zone. */
const FALLBACK: Record<StockKind, Record<StockZone, string>> = {
  fish: {
    top: 'endler',
    middle: 'harlequin-rasbora',
    bottom: 'bronze-corydoras',
    surfaces: 'otocinclus',
  },
  shrimp: {
    top: 'cherry-shrimp',
    middle: 'cherry-shrimp',
    bottom: 'cherry-shrimp',
    surfaces: 'cherry-shrimp',
  },
  snail: {
    top: 'nerite-snail',
    middle: 'nerite-snail',
    bottom: 'nerite-snail',
    surfaces: 'nerite-snail',
  },
}

/** Profile for a species id (null, unknown or betta handled by the caller). */
export function profileFor(speciesId: string | null, kind: StockKind, zone: StockZone) {
  if (speciesId && SPECIES[speciesId]) return SPECIES[speciesId]
  return SPECIES[FALLBACK[kind][zone]]
}

/** Sprite width of a creature in view widths at scale 1, given the betta sprite width. */
export function spriteWidth(profile: SpeciesProfile, fishWidth: number) {
  return (fishWidth * profile.lengthCm) / BETTA_LENGTH_CM
}

/** Drawn-quad half extents (view widths; height in widths too) for a creature at `scale`. */
export function halfExtents(profile: SpeciesProfile, fishWidth: number, scale: number) {
  const w = spriteWidth(profile, fishWidth) * scale
  return { hw: 0.56 * w, hh: 0.62 * profile.ratio * w }
}
