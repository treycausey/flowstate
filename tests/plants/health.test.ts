import { getSpecies } from '@/lib/plants/catalog'
import {
  CHECK_DUE_DAYS,
  diagnose,
  isCheckDue,
  latestCheckByPlant,
  latestReadingsOf,
  tankPlantHealth,
  type DiagnoseInput,
} from '@/lib/plants/health'
import { plantVitalityForTank } from '@/lib/plants/vitality'
import type { Plant, PlantCheck, Reading } from '@/lib/models'
import type { Health, SymptomId } from '@/lib/plants/types'

const NOW = new Date('2026-09-30T12:00:00.000Z')
const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

function plant(id: string, plantedDaysAgo: number, extra: Partial<Plant> = {}): Plant {
  return {
    id,
    tankId: 't',
    speciesId: null,
    name: id,
    placement: 'midground',
    plantedAt: day(plantedDaysAgo),
    removedAt: null,
    ...extra,
  }
}

function check(id: string, plantId: string, daysAgo: number, health: Health): PlantCheck {
  return { id, plantId, tankId: 't', ts: day(daysAgo), health, symptoms: [] }
}

function run(
  symptoms: SymptomId[],
  opts: Partial<Omit<DiagnoseInput, 'symptoms' | 'species'>> & { species?: string } = {},
) {
  return diagnose({
    symptoms,
    species: opts.species ? getSpecies(opts.species) : undefined,
    latestReadings: opts.latestReadings ?? {},
    daysSincePlanted: opts.daysSincePlanted ?? 60,
  })
}

const ids = (list: { id: string }[]) => list.map((d) => d.id)

describe('diagnose', () => {
  it('calls melting soon after planting a crypt a transition melt and tells you to leave the roots', () => {
    const result = run(['melting'], { species: 'cryptocoryne-wendtii', daysSincePlanted: 9 })
    expect(result[0].id).toBe('transition-melt')
    expect(result[0].likelihood).toBe('likely')
    expect(result[0].title).toMatch(/crypt/i)
    expect(result[0].suggestion).toMatch(/leave the roots/i)
  })

  it('treats any new plant that melts within three weeks as adapting', () => {
    const result = run(['transparent-leaves'], { species: 'water-wisteria', daysSincePlanted: 21 })
    expect(result[0].id).toBe('transition-melt')
    expect(result[0].title).not.toMatch(/crypt/i)
    // The same symptom later on is stress, not an adjustment period
    const later = run(['melting'], { species: 'water-wisteria', daysSincePlanted: 22 })
    expect(ids(later)).not.toContain('transition-melt')
    expect(ids(later)).toContain('melt-stress')
  })

  it('explains a late crypt melt as a reaction to a change', () => {
    const result = run(['melting'], { species: 'cryptocoryne-parva', daysSincePlanted: 90 })
    expect(ids(result)).toContain('crypt-change')
    expect(ids(result)).not.toContain('transition-melt')
  })

  it('blames nitrogen for yellow old leaves when nitrate tested 0, and cites the test', () => {
    const result = run(['yellowing-old-leaves'], {
      latestReadings: { nitrate: { value: 0, ts: day(1) } },
    })
    expect(result[0].id).toBe('nitrogen')
    expect(result[0].evidence).toEqual({ metric: 'nitrate', value: 0, ts: day(1) })
    // With nitrate present it does not claim a shortage
    const fine = run(['yellowing-old-leaves'], {
      latestReadings: { nitrate: { value: 10, ts: day(1) } },
    })
    expect(ids(fine)).not.toContain('nitrogen')
    expect(ids(fine)).toContain('old-leaf-age')
  })

  it('suggests root nutrients for root feeders with yellow old leaves', () => {
    expect(ids(run(['yellowing-old-leaves'], { species: 'amazon-sword' }))).toContain(
      'root-nutrients',
    )
    expect(ids(run(['yellowing-old-leaves'], { species: 'java-moss' }))).not.toContain(
      'root-nutrients',
    )
  })

  it('links pinholes to potassium and pale new growth to iron', () => {
    expect(ids(run(['pinholes']))).toEqual(['potassium'])
    expect(ids(run(['pale-new-growth']))).toEqual(['iron'])
  })

  it('links leggy stems to light', () => {
    expect(run(['leggy-growth'])[0].id).toBe('low-light')
  })

  it('links algae to nutrient and light balance, using nitrate above 20 when known', () => {
    const high = run(['algae-on-leaves'], {
      latestReadings: { nitrate: { value: 30, ts: day(2) } },
    })
    expect(high[0].id).toBe('algae-nutrients')
    expect(high[0].evidence?.value).toBe(30)
    const plain = run(['algae-on-leaves'], { species: 'anubias-nana' })
    expect(plain[0].id).toBe('algae-balance')
    expect(plain[0].title).toMatch(/slow growers/i)
  })

  it('checks the rhizome of a rhizome plant that struggles', () => {
    const result = run(['melting', 'yellowing-old-leaves'], { species: 'java-fern' })
    expect(ids(result)).toContain('buried-rhizome')
    expect(ids(run(['melting'], { species: 'amazon-sword' }))).not.toContain('buried-rhizome')
  })

  it('reads brown edges on a floating plant as wet leaves or low nutrients', () => {
    const result = run(['brown-edges'], {
      species: 'amazon-frogbit',
      latestReadings: { nitrate: { value: 0, ts: day(3) } },
    })
    expect(result[0].id).toBe('floating-wet')
    expect(result[0].suggestion).toMatch(/lid|splash/i)
    expect(result[0].evidence?.metric).toBe('nitrate')
    expect(run(['brown-edges'], { species: 'amazon-sword' })[0].id).toBe('brown-edges')
  })

  it('puts an ammonia or nitrite reading first for damage symptoms', () => {
    const result = run(['melting', 'brown-edges'], {
      species: 'amazon-sword',
      latestReadings: { ammonia: { value: 0.5, ts: day(0) }, nitrite: { value: 0, ts: day(0) } },
    })
    expect(result[0].id).toBe('ammonia-nitrite')
    expect(result[0].evidence?.metric).toBe('ammonia')
    const nitriteOnly = run(['melting'], {
      latestReadings: { ammonia: { value: 0, ts: day(0) }, nitrite: { value: 0.25, ts: day(0) } },
    })
    expect(nitriteOnly.find((d) => d.id === 'ammonia-nitrite')?.evidence?.metric).toBe('nitrite')
  })

  it('handles the remaining symptoms', () => {
    expect(ids(run(['black-beard-algae']))).toEqual(['bba'])
    expect(ids(run(['floating-loose']))).toEqual(['not-rooted'])
    expect(ids(run(['stunted'], { daysSincePlanted: 5 }))).toEqual(['settling'])
    expect(ids(run(['no-new-growth'], { species: 'anubias-nana' }))).toContain('buried-rhizome')
    expect(ids(run(['stunted'], { species: 'java-fern', daysSincePlanted: 90 }))).toContain(
      'slow-grower',
    )
    expect(ids(run(['stunted'], { species: 'hornwort', daysSincePlanted: 90 }))).toContain(
      'low-resources',
    )
  })

  it('always answers, orders most likely first, and caps the list', () => {
    expect(ids(run([]))).toEqual(['watch'])
    const many = run(
      [
        'melting',
        'yellowing-old-leaves',
        'pinholes',
        'pale-new-growth',
        'algae-on-leaves',
        'leggy-growth',
      ],
      { species: 'amazon-sword', daysSincePlanted: 10 },
    )
    expect(many.length).toBeLessThanOrEqual(4)
    expect(many[0].id).toBe('transition-melt')
  })

  it('always phrases causes as likelihoods and never gives dose amounts', () => {
    const everything = run(
      [
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
      ],
      { species: 'java-fern', latestReadings: { nitrate: { value: 0, ts: day(1) } } },
    )
    for (const d of everything) {
      expect(['likely', 'possible']).toContain(d.likelihood)
      expect(`${d.explanation} ${d.suggestion}`).not.toMatch(/\b\d+\s?(ml|drops?|tsp|tbsp|g)\b/i)
    }
  })
})

describe('latestReadingsOf', () => {
  it('takes the newest tested value of each metric', () => {
    const readings: Reading[] = [
      { id: '1', tankId: 't', ts: day(5), pH: 7, ammonia: 0, nitrite: 0, nitrate: 20 },
      { id: '2', tankId: 't', ts: day(1), pH: null, ammonia: null, nitrite: null, nitrate: 0 },
    ]
    const latest = latestReadingsOf(readings)
    expect(latest.nitrate).toEqual({ value: 0, ts: day(1) })
    expect(latest.pH).toEqual({ value: 7, ts: day(5) })
    expect(latestReadingsOf([]).nitrate).toBeNull()
  })
})

describe('check due', () => {
  it('is due after 14 days without a check, counting from planting when never checked', () => {
    const p = plant('p', 30)
    expect(isCheckDue(p, undefined, NOW)).toBe(true)
    expect(isCheckDue(plant('new', CHECK_DUE_DAYS - 1), undefined, NOW)).toBe(false)
    expect(isCheckDue(plant('edge', CHECK_DUE_DAYS), undefined, NOW)).toBe(true)
    expect(isCheckDue(p, check('c', 'p', 13, 'ok'), NOW)).toBe(false)
    expect(isCheckDue(p, check('c', 'p', 14, 'ok'), NOW)).toBe(true)
  })

  it('is never due for a removed plant', () => {
    expect(isCheckDue(plant('p', 90, { removedAt: day(1) }), undefined, NOW)).toBe(false)
  })
})

describe('tankPlantHealth', () => {
  it('counts each state, unchecked plants, struggling and checks due; ignores removed plants', () => {
    const plants = [
      plant('a', 40),
      plant('b', 40),
      plant('c', 40),
      plant('d', 3),
      plant('gone', 40, { removedAt: day(2) }),
    ]
    const checks = [
      check('1', 'a', 1, 'thriving'),
      check('2', 'a', 20, 'dead'), // older check is superseded
      check('3', 'b', 30, 'struggling'),
      check('4', 'c', 2, 'melting'),
      check('5', 'gone', 1, 'dead'),
    ]
    const h = tankPlantHealth(plants, latestCheckByPlant(checks), NOW)
    expect(h.total).toBe(4)
    expect(h.counts).toEqual({ thriving: 1, ok: 0, struggling: 1, melting: 1, dead: 0 })
    expect(h.unchecked).toBe(1)
    expect(h.struggling).toBe(2)
    expect(h.checksDue).toBe(1) // b: last check 30 days ago
    // (1 + 0.4 + 0.15 + 0.75 for the unchecked one) / 4
    expect(h.vitality).toBeCloseTo(0.575, 5)
  })

  it('reports no vitality without plants and accepts a plain object lookup', () => {
    expect(tankPlantHealth([], new Map(), NOW).vitality).toBeNull()
    const h = tankPlantHealth([plant('a', 1)], { a: check('1', 'a', 0, 'dead') }, NOW)
    expect(h.vitality).toBe(0)
  })
})

describe('plantVitalityForTank', () => {
  it('is null with no active plants, 1 when all thrive and 0 when all are dead', () => {
    expect(plantVitalityForTank([], [])).toBeNull()
    expect(plantVitalityForTank([plant('x', 5, { removedAt: day(1) })], [])).toBeNull()
    const plants = [plant('a', 5), plant('b', 5)]
    expect(
      plantVitalityForTank(plants, [
        check('1', 'a', 0, 'thriving'),
        check('2', 'b', 0, 'thriving'),
      ]),
    ).toBe(1)
    expect(
      plantVitalityForTank(plants, [check('1', 'a', 0, 'dead'), check('2', 'b', 0, 'dead')]),
    ).toBe(0)
  })

  it('reads a freshly planted, unchecked tank as calm rather than sick', () => {
    expect(plantVitalityForTank([plant('a', 1)], [])).toBe(0.75)
  })

  it('uses only the latest check of each plant', () => {
    const p = [plant('a', 30)]
    const older = check('1', 'a', 10, 'dead')
    const newer = check('2', 'a', 1, 'thriving')
    expect(plantVitalityForTank(p, [older, newer])).toBe(1)
    expect(plantVitalityForTank(p, [newer, older])).toBe(1)
  })
})
