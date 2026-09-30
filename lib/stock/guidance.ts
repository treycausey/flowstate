import type { StockGroup } from '@/lib/models'
import { speciesCountName, stockSpecies } from './catalog'
import { phRangeText, tempRangeText, volumeText } from './format'
import type { StockSpecies } from './types'

/**
 * Plain, hedged stocking guidance. Everything here is a rough guide built from the catalog's
 * comfortable ranges; none of it is a rule. Pure functions, so they are easy to test.
 */

export type FlagLevel = 'info' | 'caution' | 'danger'

export type StockFlag = {
  /** Stable key for React lists and tests. */
  id: string
  level: FlagLevel
  text: string
  /** Groups the flag is about. Empty for a whole-tank flag. */
  groupIds: string[]
}

export type GuidanceContext = {
  groups: readonly StockGroup[]
  /** The tank's latest logged pH, if any. */
  latestPH?: number | null
  /** Tank volume in litres, if set. */
  volumeL?: number | null
}

/** Groups that are in the tank now. */
export function activeGroups(groups: readonly StockGroup[]): StockGroup[] {
  return groups.filter((g) => !g.removedAt && g.count > 0)
}

/** Total animals in the active groups. */
export function animalCount(groups: readonly StockGroup[]): number {
  return activeGroups(groups).reduce((sum, g) => sum + g.count, 0)
}

export type Known = { group: StockGroup; species: StockSpecies }

function knownGroups(groups: readonly StockGroup[]): Known[] {
  const out: Known[] = []
  for (const group of activeGroups(groups)) {
    const species = stockSpecies(group.speciesId)
    if (species) out.push({ group, species })
  }
  return out
}

function labelFor(k: Known): string {
  return speciesCountName(k.species, 2)
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Groups below the species' minimum: "Neon tetras are calmer in groups of 6 or more." */
function schoolingFlags(known: Known[]): StockFlag[] {
  const flags: StockFlag[] = []
  for (const { group, species } of known) {
    if (species.minGroup <= 1 || group.count >= species.minGroup) continue
    const plural = capitalize(speciesCountName(species, 2))
    flags.push({
      id: `school:${group.id}`,
      level: 'caution',
      text: `${plural} are calmer in groups of ${species.minGroup} or more.`,
      groupIds: [group.id],
    })
  }
  return flags
}

/** With a betta in the tank, flag each tankmate by how a betta tends to treat it. */
function bettaFlags(known: Known[]): StockFlag[] {
  const bettas = known.filter((k) => k.species.id === 'betta')
  if (bettas.length === 0) return []
  const flags: StockFlag[] = []
  const bettaTotal = bettas.reduce((sum, k) => sum + k.group.count, 0)
  if (bettaTotal > 1) {
    flags.push({
      id: 'betta:multiple',
      level: 'danger',
      text: 'More than one betta: males fight, often to injury. Keep one male betta per tank unless you have planned for it.',
      groupIds: bettas.map((k) => k.group.id),
    })
  }
  for (const k of known) {
    if (k.species.id === 'betta') continue
    if (k.species.bettaCompat === 'good') continue
    const avoid = k.species.bettaCompat === 'avoid'
    flags.push({
      id: `betta:${k.group.id}`,
      level: avoid ? 'danger' : 'caution',
      text: `${capitalize(labelFor(k))} with a betta${avoid ? ' are a poor match' : ': go carefully'}. ${k.species.bettaReason}`,
      groupIds: [k.group.id],
    })
  }
  return flags
}

type Range = readonly [number, number]

function overlap(ranges: Range[]): Range | null {
  const lo = Math.max(...ranges.map((r) => r[0]))
  const hi = Math.min(...ranges.map((r) => r[1]))
  return lo <= hi ? [lo, hi] : null
}

function oneSpeciesPerId(known: Known[]): Known[] {
  const seen = new Set<string>()
  return known.filter((k) => {
    if (seen.has(k.species.id)) return false
    seen.add(k.species.id)
    return true
  })
}

/**
 * Compare the stocked species' ranges with each other. Temperature is not logged, so the
 * check is between the species, not against the tank.
 */
export function rangeFlags(
  known: Known[],
  pick: (s: StockSpecies) => Range,
  unit: {
    id: string
    name: string
    show: (r: Range) => string
    aim: (r: Range) => string
  },
): StockFlag[] {
  const species = oneSpeciesPerId(known)
  if (species.length < 2) return []
  const ranges = species.map((k) => pick(k.species))
  const shared = overlap(ranges)
  // The species with the highest minimum and the lowest maximum set the limits.
  const highMin = species.reduce((a, b) => (pick(b.species)[0] > pick(a.species)[0] ? b : a))
  const lowMax = species.reduce((a, b) => (pick(b.species)[1] < pick(a.species)[1] ? b : a))
  const limitIds = [highMin.group.id, lowMax.group.id].filter((id, i, all) => all.indexOf(id) === i)
  if (shared) {
    // Every species already shares one range: only mention it when it is narrower than some of them.
    if (ranges.every((r) => r[0] === shared[0] && r[1] === shared[1])) return []
    const limits =
      highMin === lowMax
        ? `${capitalize(labelFor(highMin))} have the narrowest range (${unit.show(pick(highMin.species))}).`
        : `${capitalize(labelFor(highMin))} prefer ${unit.show(pick(highMin.species))} and ${labelFor(lowMax)} prefer ${unit.show(pick(lowMax.species))}.`
    return [
      {
        id: `${unit.id}:shared`,
        level: 'info',
        text: `${limits} For ${unit.name}, aim for ${unit.aim(shared)}.`,
        groupIds: limitIds,
      },
    ]
  }
  return [
    {
      id: `${unit.id}:clash`,
      level: 'caution',
      text: `${capitalize(labelFor(highMin))} prefer ${unit.show(pick(highMin.species))} but ${labelFor(lowMax)} prefer ${unit.show(pick(lowMax.species))}. No single ${unit.name} suits both, so a compromise may stress one of them.`,
      groupIds: limitIds,
    },
  ]
}

/** A logged pH outside a species' comfortable range. */
function phReadingFlags(known: Known[], latestPH: number | null | undefined): StockFlag[] {
  if (latestPH === null || latestPH === undefined) return []
  const flags: StockFlag[] = []
  for (const { group, species } of known) {
    const [lo, hi] = species.ph
    if (latestPH >= lo - 0.2 && latestPH <= hi + 0.2) continue
    flags.push({
      id: `ph:${group.id}`,
      level: 'caution',
      text: `Your last pH reading was ${latestPH.toFixed(1)}. ${capitalize(speciesCountName(species, 2))} are happiest at pH ${phRangeText(species.ph)}.`,
      groupIds: [group.id],
    })
  }
  return flags
}

/** Flags about one group or several. */
export function groupFlags(ctx: GuidanceContext): StockFlag[] {
  const known = knownGroups(ctx.groups)
  return [...schoolingFlags(known), ...bettaFlags(known), ...phReadingFlags(known, ctx.latestPH)]
}

/** Flags about the whole tank: do the stocked species agree on temperature and pH? */
export function tankFlags(ctx: GuidanceContext): StockFlag[] {
  const known = knownGroups(ctx.groups)
  return [
    ...rangeFlags(known, (s) => s.tempC, {
      id: 'temp',
      name: 'temperature',
      show: tempRangeText,
      aim: tempRangeText,
    }),
    ...rangeFlags(known, (s) => s.ph, {
      id: 'ph-range',
      name: 'pH',
      show: (r) => `pH ${phRangeText(r)}`,
      aim: (r) => (r[0] === r[1] ? `about pH ${r[0].toFixed(1)}` : `pH ${phRangeText(r)}`),
    }),
  ]
}

/** Every flag that mentions this group. */
export function flagsForGroup(flags: readonly StockFlag[], groupId: string): StockFlag[] {
  return flags.filter((f) => f.groupIds.includes(groupId))
}

export type StockingLevel = 'light' | 'moderate' | 'heavy'

export type StockingEstimate = {
  level: StockingLevel
  /** Total relative load, in neon tetra units. */
  load: number
  /** Conservative capacity for this volume, in the same units. */
  capacity: number
  text: string
}

/** One neon-tetra unit per this many litres is treated as a full tank. A deliberately cautious figure. */
export const LITRES_PER_LOAD_UNIT = 6

/**
 * A rough stocking estimate. Null when the volume is unknown or nothing is stocked.
 * Custom species count as one unit per animal.
 */
export function stockingEstimate(
  groups: readonly StockGroup[],
  volumeL: number | null | undefined,
): StockingEstimate | null {
  if (!volumeL || volumeL <= 0) return null
  const active = activeGroups(groups)
  if (active.length === 0) return null
  const load = active.reduce(
    (sum, g) => sum + g.count * (stockSpecies(g.speciesId)?.bioload ?? 1),
    0,
  )
  const capacity = volumeL / LITRES_PER_LOAD_UNIT
  const ratio = load / capacity
  const level: StockingLevel = ratio <= 0.5 ? 'light' : ratio <= 1 ? 'moderate' : 'heavy'
  const lead: Record<StockingLevel, string> = {
    light: `Looks lightly stocked for ${volumeText(volumeL)}.`,
    moderate: `Looks moderately stocked for ${volumeText(volumeL)}.`,
    heavy: `Looks heavily stocked for ${volumeText(volumeL)}. Think twice before adding more.`,
  }
  const tail =
    ' A rough guide, not a rule: filtration, plants and regular water changes matter as much as the numbers.'
  return {
    level,
    load: Math.round(load * 10) / 10,
    capacity: Math.round(capacity * 10) / 10,
    text: lead[level] + tail,
  }
}
