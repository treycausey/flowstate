import type { Metric, Plant, PlantCheck } from '../models'
import { calendarDaysBetween, compareTs } from '../time'
import { metricStatus } from '../status'
import type { Reading } from '../models'
import {
  HEALTH_LEVELS,
  type Health,
  type Placement,
  type PlantSpecies,
  type SymptomId,
  SYMPTOM_IDS,
} from './types'

// ---- Symptoms and health levels -----------------------------------------------------------

export const SYMPTOMS: Record<SymptomId, { label: string; explain: string }> = {
  'yellowing-old-leaves': {
    label: 'Yellowing old leaves',
    explain: 'The oldest, lowest leaves turn yellow while new growth looks fine.',
  },
  'pale-new-growth': {
    label: 'Pale new growth',
    explain: 'New leaves come in pale or yellow-green instead of a normal colour.',
  },
  pinholes: {
    label: 'Pinholes',
    explain: 'Small round holes appear in leaves, usually older ones.',
  },
  'brown-edges': {
    label: 'Brown edges',
    explain: 'Leaf edges or tips turn brown or crispy.',
  },
  melting: {
    label: 'Melting',
    explain: 'Leaves go soft or see-through and fall apart.',
  },
  'leggy-growth': {
    label: 'Leggy growth',
    explain: 'Stems stretch out with wide gaps between the leaves.',
  },
  stunted: {
    label: 'Stunted',
    explain: 'The plant is smaller than expected and its leaves stay small.',
  },
  'algae-on-leaves': {
    label: 'Algae on leaves',
    explain: 'A green, brown or fuzzy film covers the leaves.',
  },
  'transparent-leaves': {
    label: 'Transparent leaves',
    explain: 'Leaves look glassy or see-through before they collapse.',
  },
  'floating-loose': {
    label: 'Floating loose',
    explain: 'The plant or its cuttings keep coming out of the substrate and float up.',
  },
  'black-beard-algae': {
    label: 'Black beard algae',
    explain: 'Short dark grey or black tufts grow on leaf edges and hard surfaces.',
  },
  'no-new-growth': {
    label: 'No new growth',
    explain: 'The plant has stopped producing new leaves.',
  },
}

export function isSymptomId(value: unknown): value is SymptomId {
  return typeof value === 'string' && (SYMPTOM_IDS as readonly string[]).includes(value)
}

export function isHealth(value: unknown): value is Health {
  return typeof value === 'string' && (HEALTH_LEVELS as readonly string[]).includes(value)
}

export const HEALTH_LABEL: Record<Health, string> = {
  thriving: 'Thriving',
  ok: 'OK',
  struggling: 'Struggling',
  melting: 'Melting',
  dead: 'Dead',
}

export const HEALTH_HINT: Record<Health, string> = {
  thriving: 'Growing well, good colour',
  ok: 'Fine, nothing to fix',
  struggling: 'Slow, pale or damaged',
  melting: 'Leaves falling apart',
  dead: 'Not coming back',
}

export type HealthTone = 'ok' | 'caution' | 'danger'

export const HEALTH_TONE: Record<Health, HealthTone> = {
  thriving: 'ok',
  ok: 'ok',
  struggling: 'caution',
  melting: 'danger',
  dead: 'danger',
}

/** Vitality contribution of each health state (0 dead .. 1 thriving). */
export const HEALTH_SCORE: Record<Health, number> = {
  thriving: 1,
  ok: 0.75,
  struggling: 0.4,
  melting: 0.15,
  dead: 0,
}

/** A plant with no check for this many days shows "Check due". */
export const CHECK_DUE_DAYS = 14

/** Days after planting during which melting is expected as a plant adapts to the tank. */
export const TRANSITION_DAYS = 21

// ---- Per-tank helpers -------------------------------------------------------------------------

export const isActivePlant = (p: Plant) => !p.removedAt

/** Newest check per plant id. */
export function latestCheckByPlant(checks: PlantCheck[]): Map<string, PlantCheck> {
  const latest = new Map<string, PlantCheck>()
  for (const c of checks) {
    const prev = latest.get(c.plantId)
    if (!prev || compareTs(prev, c) < 0) latest.set(c.plantId, c)
  }
  return latest
}

export function daysSincePlanted(plant: Plant, now = new Date()): number {
  return calendarDaysBetween(new Date(plant.plantedAt), now)
}

/** Days since the last check, or since planting when never checked. */
export function daysSinceLastCheck(plant: Plant, latest: PlantCheck | undefined, now = new Date()) {
  return calendarDaysBetween(new Date(latest?.ts ?? plant.plantedAt), now)
}

export function isCheckDue(plant: Plant, latest: PlantCheck | undefined, now = new Date()) {
  return !plant.removedAt && daysSinceLastCheck(plant, latest, now) >= CHECK_DUE_DAYS
}

export type TankPlantHealth = {
  /** Active plants counted. */
  total: number
  /** 0..1 average of the latest health; plants never checked count as OK. Null with no plants. */
  vitality: number | null
  counts: Record<Health, number>
  /** Active plants that have never been checked. */
  unchecked: number
  /** Plants whose latest check is struggling or melting. */
  struggling: number
  checksDue: number
}

export function tankPlantHealth(
  plants: Plant[],
  latestChecks: Map<string, PlantCheck> | Record<string, PlantCheck | undefined>,
  now = new Date(),
): TankPlantHealth {
  const lookup = (id: string) =>
    latestChecks instanceof Map ? latestChecks.get(id) : latestChecks[id]
  const counts = { thriving: 0, ok: 0, struggling: 0, melting: 0, dead: 0 } satisfies Record<
    Health,
    number
  >
  let unchecked = 0
  let checksDue = 0
  let scoreSum = 0
  const active = plants.filter(isActivePlant)
  for (const plant of active) {
    const latest = lookup(plant.id)
    if (latest) {
      counts[latest.health]++
      scoreSum += HEALTH_SCORE[latest.health]
    } else {
      unchecked++
      scoreSum += HEALTH_SCORE.ok
    }
    if (isCheckDue(plant, latest, now)) checksDue++
  }
  return {
    total: active.length,
    vitality: active.length === 0 ? null : scoreSum / active.length,
    counts,
    unchecked,
    struggling: counts.struggling + counts.melting,
    checksDue,
  }
}

// ---- Diagnosis --------------------------------------------------------------------------------

export type LatestReadings = Partial<Record<Metric, { value: number; ts: string } | null>>

/** The most recent tested value of each metric. */
export function latestReadingsOf(readings: Reading[]): LatestReadings {
  return {
    pH: metricStatus(readings, 'pH').latest,
    ammonia: metricStatus(readings, 'ammonia').latest,
    nitrite: metricStatus(readings, 'nitrite').latest,
    nitrate: metricStatus(readings, 'nitrate').latest,
  }
}

export type Diagnosis = {
  id: string
  title: string
  likelihood: 'likely' | 'possible'
  explanation: string
  suggestion: string
  /** The water test behind this cause, when there is one. */
  evidence?: { metric: Metric; value: number; ts: string }
}

export type DiagnoseInput = {
  symptoms: readonly SymptomId[]
  species?: PlantSpecies
  /** Where the plant sits. Decides the advice for custom plants, which have no species. */
  placement?: Placement
  latestReadings: LatestReadings
  daysSincePlanted: number
}

type Scored = Diagnosis & { score: number }

const MAX_DIAGNOSES = 4

/**
 * Likely causes for the symptoms picked in a health check, most likely first. This is general
 * hobby guidance phrased as "often" and "likely". It never gives a dose amount.
 */
export function diagnose({
  symptoms,
  species,
  placement,
  latestReadings,
  daysSincePlanted: age,
}: DiagnoseInput): Diagnosis[] {
  const has = (...ids: SymptomId[]) => ids.some((id) => symptoms.includes(id))
  const out: Scored[] = []
  const add = (d: Omit<Scored, 'likelihood'> & { likelihood?: Diagnosis['likelihood'] }) =>
    out.push({ likelihood: d.score >= 70 ? 'likely' : 'possible', ...d })
  const reading = (metric: Metric) => latestReadings[metric] ?? undefined
  const nitrate = reading('nitrate')
  const ammonia = reading('ammonia')
  const nitrite = reading('nitrite')
  const isCrypt = species?.scientific.startsWith('Cryptocoryne') ?? false
  const effectivePlacement = species?.placement ?? placement
  // A custom floating plant has no species detail, so treat it as a surface floater: it never
  // gets substrate advice and gets the wet-leaf text.
  const isSurfaceFloater = species ? species.surfaceFloater === true : placement === 'floating'
  const isSubmergedFloater = species?.placement === 'floating' && !species.surfaceFloater
  const melting = has('melting', 'transparent-leaves')

  if (melting && age <= TRANSITION_DAYS) {
    add({
      id: 'transition-melt',
      score: 100,
      title: isCrypt ? 'Crypt melt after planting' : 'Adapting to the tank',
      explanation: isCrypt
        ? 'Cryptocoryne are well known for melting in the first weeks. The leaves they were grown with were made for different water, so they fall apart and the plant grows new ones.'
        : 'Plants grown out of water or in a different tank often drop their old leaves while they adapt, then regrow leaves that suit your water. This is normal in the first few weeks.',
      suggestion:
        'Leave the roots and the crown or rhizome in place. Remove only leaves that have fully rotted, keep the water steady and give it a few weeks.',
    })
  } else if (melting && isCrypt) {
    add({
      id: 'crypt-change',
      score: 75,
      title: 'Reacting to a change',
      explanation:
        'Cryptocoryne often melt after a sudden change in water, light or position, even months after planting. The roots usually survive.',
      suggestion:
        'Think back to what changed recently and keep things steady from here. Leave the roots in place and expect new leaves after some weeks.',
    })
  }

  if (
    ((ammonia?.value ?? 0) > 0 || (nitrite?.value ?? 0) > 0) &&
    has('melting', 'transparent-leaves', 'brown-edges', 'stunted', 'yellowing-old-leaves')
  ) {
    const metric: Metric = (ammonia?.value ?? 0) > 0 ? 'ammonia' : 'nitrite'
    const found = metric === 'ammonia' ? ammonia : nitrite
    add({
      id: 'ammonia-nitrite',
      score: 90,
      title: 'Ammonia or nitrite in the water',
      explanation:
        'Your latest test shows ammonia or nitrite. That stresses fish first and can damage sensitive plants, so it is worth fixing whatever the plants are doing. Rotting leaves can also be what is raising it.',
      suggestion:
        'Retest, and if it is still above 0 do a partial water change. Look for the source, such as a dead plant, extra food or a filter that is not working.',
      evidence: found ? { metric, value: found.value, ts: found.ts } : undefined,
    })
  }

  if (species?.rhizome && has('melting', 'yellowing-old-leaves', 'stunted', 'no-new-growth')) {
    add({
      id: 'buried-rhizome',
      score: 60,
      title: 'The rhizome may be buried',
      explanation:
        'Anubias, java fern and bucephalandra grow from a thick horizontal stem, the rhizome. If it is buried in substrate it often rots and the leaves decline.',
      suggestion: /substrate/i.test(species.planting)
        ? 'Lift the plant and check the rhizome. Attach it to wood or rock with thread or a gel glue made for aquariums, or keep the rhizome above the substrate with only the roots in it.'
        : 'Lift the plant and check the rhizome. Attach it to wood or rock with thread or a gel glue made for aquariums. Do not put any of it in the substrate.',
    })
  }

  if (has('leggy-growth')) {
    add({
      id: 'low-light',
      score: 80,
      title: 'Not enough light',
      explanation:
        'Stems that stretch with wide gaps between leaves are often reaching for more light, or are shaded by taller plants or floating plants.',
      suggestion:
        'Move the plant closer to the light or clear away what shades it. Trim the stretched tops and replant them. Longer lighting raises the risk of algae, so change one thing at a time.',
    })
  }

  if (has('yellowing-old-leaves')) {
    if (nitrate && nitrate.value === 0) {
      add({
        id: 'nitrogen',
        score: 80,
        title: 'Nitrogen shortage',
        explanation:
          'Your latest nitrate test read 0. In a planted tank the plants can use up all the nitrogen, and the oldest leaves yellow first because the plant moves nitrogen to new growth.',
        suggestion:
          'Nitrogen comes from fish food and waste, so a lightly stocked tank with many plants can run out. Recheck nitrate in a few days. If it stays at 0 and the yellowing continues, a planted-tank fertiliser that contains nitrogen may help, used as its label says.',
        evidence: { metric: 'nitrate', value: nitrate.value, ts: nitrate.ts },
      })
    }
    if (species?.feeding === 'root') {
      add({
        id: 'root-nutrients',
        score: 60,
        title: 'The roots may be short of nutrients',
        explanation:
          'Root feeders such as crypts, swords and sagittaria take most of their nutrients from the substrate. Yellow old leaves often mean the substrate has been used up.',
        suggestion:
          'A root fertiliser made for planted tanks, used as its label says, can help. Do not disturb the roots while the plant is recovering.',
      })
    }
    add({
      id: 'old-leaf-age',
      score: 40,
      title: 'Ordinary ageing, or shading',
      explanation:
        'Old leaves yellow and drop as a plant grows new ones, and lower leaves also yellow when they are shaded by the plant above. A few yellow leaves is usually not a concern.',
      suggestion:
        'Remove leaves that are fully yellow. If it keeps spreading to newer leaves, check the light and nutrients.',
    })
  }

  if (has('pinholes')) {
    add({
      id: 'potassium',
      score: 70,
      title: 'Potassium shortage',
      explanation:
        'Small round holes in older leaves are often a sign of low potassium. Fast-growing plants and tanks with many plants use it up.',
      suggestion:
        'A planted-tank fertiliser that contains potassium may help, used as its label says. Check whether the holes appear on new leaves too. Snails or fish can also chew holes; chewed holes are ragged rather than round.',
    })
  }

  if (has('pale-new-growth')) {
    add({
      id: 'iron',
      score: 70,
      title: 'Iron shortage',
      explanation:
        'New leaves that come in pale or yellow with green veins often point to low iron, since the plant cannot move iron from old leaves to new ones.',
      suggestion:
        'A planted-tank fertiliser that contains iron may help, used as its label says. Also check the light is not far too strong, which bleaches leaves.',
    })
  }

  if (has('algae-on-leaves')) {
    if (nitrate && nitrate.value > 20) {
      add({
        id: 'algae-nutrients',
        score: 75,
        title: 'Nutrients and light out of balance',
        explanation:
          'Your latest nitrate is above 20 ppm. Algae tends to win when nutrients or light are high compared with what the plants can use. Slow growers suffer most because algae settles on their old leaves.',
        suggestion:
          'A partial water change and less light per day usually help. About 6 to 8 hours of light is a common range, and direct sunlight is best avoided.',
        evidence: { metric: 'nitrate', value: nitrate.value, ts: nitrate.ts },
      })
    } else {
      add({
        id: 'algae-balance',
        score: 55,
        title: species?.growth === 'slow' ? 'Slow growers collect algae' : 'Light out of balance',
        explanation:
          species?.growth === 'slow'
            ? 'Slow-growing plants keep their leaves for a long time, so algae has time to settle on them. Too much light makes it worse.'
            : 'Algae often appears when light is strong or long compared with what the plants can use.',
        suggestion:
          'Shorten the light period or reduce the light, remove badly covered leaves and wipe off the rest. About 6 to 8 hours a day is a common range.',
      })
    }
  }

  if (has('black-beard-algae')) {
    add({
      id: 'bba',
      score: 70,
      title: 'Black beard algae',
      explanation:
        'This algae often shows up when organic waste builds up (old leaves, trapped debris, a dirty filter), when there is more light than the plants can use, or in tanks with added CO₂ when the CO₂ level swings. It settles on slow, older leaves and on hard surfaces, often near the filter outlet.',
      suggestion:
        'Trim the worst leaves, clear out debris and rinse the filter media in tank water, keep up regular partial water changes and keep the light period steady. Do not expect it to disappear quickly.',
    })
  }

  if (has('brown-edges')) {
    if (isSurfaceFloater) {
      add({
        id: 'floating-wet',
        score: 78,
        title: 'Wet leaves, or low nutrients',
        explanation:
          'Floating plants brown when the leaf tops stay wet from splashing or from condensation dripping off a close lid. Low nutrients in the water can do the same.',
        suggestion:
          'Reduce surface splash, leave a small gap between the lid and the water and thin out crowding. If nitrate reads 0, low nutrients may also play a part.',
        evidence:
          nitrate && nitrate.value === 0
            ? { metric: 'nitrate', value: nitrate.value, ts: nitrate.ts }
            : undefined,
      })
    } else {
      add({
        id: 'brown-edges',
        score: 50,
        title: 'Wear, or a nutrient shortage',
        explanation:
          'Old leaves brown at the edges with age, and a shortage of nutrients such as potassium can add to it. If only the oldest leaves are affected it is often just wear.',
        suggestion:
          'Trim the damaged leaves. If new leaves brown too, look for a recent change in the water or a nutrient shortage.',
      })
    }
  }

  if (has('floating-loose') && !isSurfaceFloater) {
    if (isSubmergedFloater) {
      add({
        id: 'not-rooted',
        score: 65,
        title: 'Floating is normal',
        explanation: 'Hornwort and similar plants have no true roots, so they drift.',
        suggestion: 'Floating is normal for hornwort; weigh a stem down if you want it anchored.',
      })
    } else if (species?.rhizome || effectivePlacement === 'epiphyte') {
      add({
        id: 'not-rooted',
        score: 65,
        title: 'Not attached yet',
        explanation:
          'New cuttings and small portions often float up until they grow roots or hold on. Fish digging can also pull them loose.',
        suggestion:
          'Tie it back onto wood or rock with thread, or use a gel glue made for aquariums. Do not push it into the substrate.',
      })
    } else if (species?.id === 'marimo-moss-ball') {
      add({
        id: 'not-rooted',
        score: 65,
        title: 'Trapped gas',
        explanation: 'A marimo ball floats when gas bubbles are trapped inside it.',
        suggestion: 'Squeeze it gently under water to release the bubbles and it sinks again.',
      })
    } else {
      add({
        id: 'not-rooted',
        score: 65,
        title: 'Not anchored yet',
        explanation:
          'New cuttings and small portions often float up until they grow roots. Fish digging, or a stem cut too short, can also pull them out.',
        suggestion:
          'Push the base a few cm into the substrate, or hold it down with a small stone or plant weight until roots take hold.',
      })
    }
  }

  if (has('stunted', 'no-new-growth')) {
    if (age <= TRANSITION_DAYS) {
      add({
        id: 'settling',
        score: 68,
        title: 'Still settling in',
        explanation:
          'A new plant often pauses for a few weeks while it grows roots and adapts. That is normal.',
        suggestion: 'Leave it alone and keep the water steady.',
      })
    } else if (species?.growth === 'slow') {
      add({
        id: 'slow-grower',
        score: 45,
        title: 'It may just be a slow plant',
        explanation: `${species.name} is a slow grower, so a new leaf every few weeks can be normal.`,
        suggestion: 'Give it time, and look at the light and nutrients only if it declines.',
      })
    } else {
      add({
        id: 'low-resources',
        score: 50,
        title: 'Low light or low nutrients',
        explanation:
          'Plants that stop growing are often short of light, nutrients or both. A nitrate reading of 0 points to a shortage of nutrients.',
        suggestion:
          'Check the light and the nitrate reading first, then change one thing at a time.',
        evidence:
          nitrate && nitrate.value === 0
            ? { metric: 'nitrate', value: nitrate.value, ts: nitrate.ts }
            : undefined,
      })
    }
  }

  if (melting && !isCrypt && age > TRANSITION_DAYS) {
    add({
      id: 'melt-stress',
      score: 55,
      title: 'Stress from a change',
      explanation:
        'Established plants melt when something changes: a large water change, a move, a swing in temperature or light, or a shortage of nutrients.',
      suggestion:
        'Think back to what changed and keep conditions steady. Trim what has rotted so it does not foul the water, and leave the healthy parts.',
    })
  }

  if (out.length === 0) {
    add({
      id: 'watch',
      score: 10,
      title: 'Nothing stands out',
      explanation:
        'The symptoms you picked do not point at one clear cause. Plants often show several small issues at once.',
      suggestion:
        'Keep conditions steady, trim damaged leaves and check again in a week. Change one thing at a time.',
    })
  }

  return out
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DIAGNOSES)
    .map((d) => ({
      id: d.id,
      title: d.title,
      likelihood: d.likelihood,
      explanation: d.explanation,
      suggestion: d.suggestion,
      ...(d.evidence ? { evidence: d.evidence } : {}),
    }))
}
