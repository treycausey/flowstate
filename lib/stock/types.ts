export const STOCK_KINDS = ['fish', 'shrimp', 'snail'] as const
export type StockKind = (typeof STOCK_KINDS)[number]

export const KIND_LABEL: Record<StockKind, string> = {
  fish: 'Fish',
  shrimp: 'Shrimp',
  snail: 'Snails',
}

export const STOCK_ZONES = ['top', 'middle', 'bottom', 'surfaces'] as const
export type StockZone = (typeof STOCK_ZONES)[number]

export const ZONE_LABEL: Record<StockZone, string> = {
  top: 'Top',
  middle: 'Middle',
  bottom: 'Bottom',
  surfaces: 'Surfaces',
}

export type Temperament = 'peaceful' | 'semi-aggressive' | 'territorial'

/** How an animal is likely to get on with a betta in the same tank. */
export type BettaCompat = 'good' | 'caution' | 'avoid'

export type StockSpecies = {
  id: string
  /** Common name, singular ("Neon tetra"). */
  name: string
  /** Plural form for counts ("neon tetras"). Defaults to name + "s". */
  plural?: string
  scientific: string
  /** Other names people search for. */
  aliases?: string[]
  kind: StockKind
  zone: StockZone
  /** Typical adult size in cm. */
  sizeCm: number
  /** Comfortable temperature range in °C [min, max]. */
  tempC: readonly [number, number]
  /** Comfortable pH range [min, max]. */
  ph: readonly [number, number]
  /** Smallest group that keeps the species calm; 1 for animals that do best alone or in any number. */
  minGroup: number
  temperament: Temperament
  diet: string
  /**
   * Relative waste per animal, in "neon tetra" units (one neon tetra is 1). A rough input for
   * the stocking estimate, not a measurement.
   */
  bioload: number
  bettaCompat: BettaCompat
  bettaReason: string
  care: string
  notes: string
}
