export const PLACEMENTS = ['foreground', 'midground', 'background', 'floating', 'epiphyte'] as const
export type Placement = (typeof PLACEMENTS)[number]

export const PLACEMENT_LABEL: Record<Placement, string> = {
  foreground: 'Foreground',
  midground: 'Midground',
  background: 'Background',
  floating: 'Floating',
  epiphyte: 'Epiphyte',
}

export const HEALTH_LEVELS = ['thriving', 'ok', 'struggling', 'melting', 'dead'] as const
export type Health = (typeof HEALTH_LEVELS)[number]

export const ACTIONS = ['trimmed', 'replanted', 'moved', 'fed', 'cleaned', 'none'] as const
export type PlantAction = (typeof ACTIONS)[number]

export const SYMPTOM_IDS = [
  'yellowing-old-leaves',
  'pale-new-growth',
  'pinholes',
  'brown-edges',
  'melting',
  'leggy-growth',
  'stunted',
  'algae-on-leaves',
  'transparent-leaves',
  'floating-loose',
  'black-beard-algae',
  'no-new-growth',
] as const
export type SymptomId = (typeof SYMPTOM_IDS)[number]

export type Difficulty = 'easy' | 'moderate' | 'demanding'
export type LightNeed = 'low' | 'medium' | 'high'
export type Co2Need = 'not needed' | 'helps' | 'recommended'
export type GrowthRate = 'slow' | 'moderate' | 'fast'
export type FeedingMode = 'root' | 'water column' | 'both'

export type PlantSpecies = {
  id: string
  name: string
  scientific: string
  /** Other names people search for. */
  aliases?: string[]
  placement: Placement
  difficulty: Difficulty
  light: LightNeed
  co2: Co2Need
  growth: GrowthRate
  feeding: FeedingMode
  /** Rhizome plants rot when buried: attach to wood or rock. */
  rhizome?: boolean
  /** Floats on the surface with its leaf tops in air (not fully submerged like hornwort). */
  surfaceFloater?: boolean
  /** Suits a typical betta tank (warm, gentle flow, fin-safe leaves). */
  bettaFriendly: boolean
  /** Comfortable pH range [min, max]. */
  ph: readonly [number, number]
  /** Comfortable temperature range in °C [min, max]. */
  tempC: readonly [number, number]
  /** Typical upper height in cm when grown out. Omitted when it varies too much to state. */
  maxHeightCm?: number
  propagation: string
  planting: string
  care: string
  bettaNote: string
  commonProblems: readonly SymptomId[]
}
