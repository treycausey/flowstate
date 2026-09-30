// Turns recorded stock into what the tank draws: which species, how many of each (capped), which
// motion model. Counts above the caps are represented, not literal. Pure.

import {
  BETTA_ID,
  profileFor,
  SPECIES,
  type MotionModel,
  type SpeciesProfile,
  type StockEntry,
} from './species'

export type { StockEntry, StockKind, StockZone } from './species'

/** Most creatures drawn at once. */
export const MAX_CREATURES = 32

/** Higher draws first when the total cap bites: solitary > school > bottom > the rest. */
const MODEL_PRIORITY: Record<MotionModel, number> = {
  solitary: 0,
  school: 1,
  bottom: 2,
  kuhli: 3,
  grazer: 3,
  crawler: 4,
}

export type PlannedGroup = {
  profile: SpeciesProfile
  /** How many are drawn. */
  render: number
  /** How many are recorded. */
  recorded: number
}

export type StockPlan = {
  /** The betta swims (no stock recorded, or a betta is in the stock). */
  betta: boolean
  groups: PlannedGroup[]
  total: number
}

/** A stable string for a plan, to tell when the stock really changed. */
export function planKey(plan: StockPlan): string {
  return `${plan.betta ? 'B' : '-'}|${plan.groups.map((g) => `${g.profile.id}:${g.render}`).join(',')}`
}

/** `maxTotal` lowers the cap when the frame rate drops or the free water is small. */
export function planStock(entries: readonly StockEntry[], maxTotal = MAX_CREATURES): StockPlan {
  if (entries.length === 0) return { betta: true, groups: [], total: 1 }
  let betta = false
  const counts = new Map<string, { profile: SpeciesProfile; recorded: number }>()
  for (const e of entries) {
    if (!(e.count > 0)) continue
    const n = Math.floor(e.count)
    if (e.speciesId === BETTA_ID) {
      betta = true
      continue
    }
    const profile = profileFor(e.speciesId, e.kind, e.zone)
    const prev = counts.get(profile.id)
    if (prev) prev.recorded += n
    else counts.set(profile.id, { profile, recorded: n })
  }
  if (!betta && counts.size === 0) return { betta: true, groups: [], total: 1 }
  const ordered = [...counts.values()].sort(
    (a, b) =>
      MODEL_PRIORITY[a.profile.model] - MODEL_PRIORITY[b.profile.model] ||
      b.recorded - a.recorded ||
      a.profile.id.localeCompare(b.profile.id),
  )
  let left = Math.max(0, maxTotal - (betta ? 1 : 0))
  const groups: PlannedGroup[] = []
  for (const { profile, recorded } of ordered) {
    const render = Math.min(recorded, profile.maxRender, left)
    if (render <= 0) continue
    left -= render
    groups.push({ profile, render, recorded })
  }
  return { betta, groups, total: (betta ? 1 : 0) + groups.reduce((s, g) => s + g.render, 0) }
}

/** Whether an id is known to the profile table (for the dev controls). */
export const isKnownSpecies = (id: string) => id === BETTA_ID || id in SPECIES

/** A stock line for a species id, with the kind and zone its profile implies (dev controls, tests). */
export function stockEntry(speciesId: string, count: number): StockEntry {
  if (speciesId === BETTA_ID) return { speciesId, count, zone: 'top', kind: 'fish' }
  const p = SPECIES[speciesId]
  if (!p) return { speciesId, count, zone: 'middle', kind: 'fish' }
  const zone =
    p.model === 'bottom' || p.model === 'kuhli'
      ? 'bottom'
      : p.model === 'grazer' || p.model === 'crawler'
        ? 'surfaces'
        : 'middle'
  return { speciesId, count, zone, kind: p.kind }
}

/** `neon-tetra:10,panda-corydoras:6` to stock lines. Unknown species and bad counts are skipped. */
export function parseStockParam(raw: string | null): StockEntry[] {
  if (!raw) return []
  return raw.split(',').flatMap((part) => {
    const [id, n] = part.split(':')
    const count = Number(n ?? 1)
    if (!id || !isKnownSpecies(id) || !Number.isFinite(count) || count <= 0) return []
    return [stockEntry(id, Math.floor(count))]
  })
}

export function formatStockParam(entries: readonly StockEntry[]): string {
  return entries.map((e) => `${e.speciesId}:${e.count}`).join(',')
}

export const STOCK_PRESETS: ReadonlyArray<{ label: string; stock: StockEntry[] }> = [
  { label: 'Betta only', stock: [] },
  {
    label: 'Betta + corys + shrimp',
    stock: [
      stockEntry('betta', 1),
      stockEntry('panda-corydoras', 4),
      stockEntry('cherry-shrimp', 5),
    ],
  },
  {
    label: 'Neon community',
    stock: [
      stockEntry('neon-tetra', 10),
      stockEntry('panda-corydoras', 6),
      stockEntry('otocinclus', 3),
      stockEntry('cherry-shrimp', 5),
      stockEntry('nerite-snail', 2),
    ],
  },
  {
    label: 'Nano',
    stock: [
      stockEntry('chili-rasbora', 12),
      stockEntry('cherry-shrimp', 8),
      stockEntry('ramshorn-snail', 2),
    ],
  },
]
