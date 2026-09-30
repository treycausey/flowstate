import {
  PLANT_CATALOG,
  filterSpecies,
  formatPh,
  formatTemp,
  getSpecies,
} from '@/lib/plants/catalog'
import { SYMPTOMS } from '@/lib/plants/health'
import { PLACEMENTS, SYMPTOM_IDS } from '@/lib/plants/types'

const EXPECTED_IDS = [
  'anubias-nana',
  'anubias-barteri',
  'java-fern',
  'java-moss',
  'christmas-moss',
  'cryptocoryne-wendtii',
  'cryptocoryne-parva',
  'amazon-sword',
  'vallisneria',
  'dwarf-sagittaria',
  'rotala-rotundifolia',
  'ludwigia-repens',
  'hygrophila-polysperma',
  'water-wisteria',
  'bacopa-caroliniana',
  'dwarf-hairgrass',
  'monte-carlo',
  'staurogyne-repens',
  'bucephalandra',
  'marimo-moss-ball',
  'amazon-frogbit',
  'salvinia',
  'hornwort',
  'anacharis',
]

describe('plant catalog integrity', () => {
  it('has exactly the 24 agreed species, once each', () => {
    expect(PLANT_CATALOG.map((s) => s.id).sort()).toEqual([...EXPECTED_IDS].sort())
    expect(new Set(PLANT_CATALOG.map((s) => s.id)).size).toBe(24)
  })

  it.each(PLANT_CATALOG.map((s) => [s.id, s] as const))('%s is complete and sane', (_id, s) => {
    expect(s.name.trim()).not.toBe('')
    expect(s.scientific.trim()).not.toBe('')
    expect(PLACEMENTS).toContain(s.placement)
    expect(['easy', 'moderate', 'demanding']).toContain(s.difficulty)
    expect(['low', 'medium', 'high']).toContain(s.light)
    expect(['not needed', 'helps', 'recommended']).toContain(s.co2)
    expect(['slow', 'moderate', 'fast']).toContain(s.growth)
    expect(['root', 'water column', 'both']).toContain(s.feeding)
    expect(typeof s.bettaFriendly).toBe('boolean')

    const [phMin, phMax] = s.ph
    expect(phMin).toBeGreaterThanOrEqual(5)
    expect(phMax).toBeLessThanOrEqual(9)
    expect(phMin).toBeLessThan(phMax)

    const [tMin, tMax] = s.tempC
    expect(tMin).toBeGreaterThanOrEqual(10)
    expect(tMax).toBeLessThanOrEqual(32)
    expect(tMin).toBeLessThan(tMax)

    if (s.maxHeightCm !== undefined) {
      expect(s.maxHeightCm).toBeGreaterThan(0)
      expect(s.maxHeightCm).toBeLessThanOrEqual(100)
    }

    // One or two sentences each, never empty and never a wall of text
    for (const text of [s.propagation, s.planting, s.care, s.bettaNote]) {
      expect(text.trim().length).toBeGreaterThan(20)
      expect(text.length).toBeLessThan(560)
      expect((text.match(/[.!?](\s|$)/g) ?? []).length).toBeLessThanOrEqual(6)
    }
  })

  it('only lists common problems that exist', () => {
    for (const s of PLANT_CATALOG) {
      expect(s.commonProblems.length).toBeGreaterThan(0)
      for (const p of s.commonProblems) expect(SYMPTOM_IDS).toContain(p)
      expect(new Set(s.commonProblems).size).toBe(s.commonProblems.length)
    }
  })

  it('has a label and explanation for every symptom', () => {
    for (const id of SYMPTOM_IDS) {
      expect(SYMPTOMS[id].label).not.toBe('')
      expect(SYMPTOMS[id].explain).not.toBe('')
    }
  })

  it('never gives dose amounts', () => {
    const text = JSON.stringify(PLANT_CATALOG)
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s?(ml|mL|drops?|tsp|tbsp|mg\/l|ppm)\b/)
  })

  it('marks the rhizome plants that rot when buried', () => {
    const rhizome = PLANT_CATALOG.filter((s) => s.rhizome).map((s) => s.id)
    expect(rhizome.sort()).toEqual(
      ['anubias-barteri', 'anubias-nana', 'bucephalandra', 'java-fern'].sort(),
    )
    for (const s of PLANT_CATALOG.filter((x) => x.rhizome)) {
      expect(s.planting).toMatch(/not/i)
      expect(s.planting).toMatch(/bur/i)
    }
  })

  it('tells people never to release the four regulated species', () => {
    for (const id of ['hygrophila-polysperma', 'salvinia', 'anacharis', 'amazon-frogbit']) {
      const s = getSpecies(id)!
      expect(`${s.care} ${s.planting}`).toMatch(/never release/i)
    }
  })

  it('flags exactly frogbit and salvinia as surface floaters', () => {
    expect(
      PLANT_CATALOG.filter((s) => s.surfaceFloater)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['amazon-frogbit', 'salvinia'])
  })

  it('warns about the surface for every floating plant', () => {
    for (const s of PLANT_CATALOG.filter(
      (x) => x.placement === 'floating' && x.id !== 'hornwort',
    )) {
      expect(s.bettaNote.toLowerCase()).toContain('surface')
    }
  })
})

describe('catalog helpers', () => {
  it('looks a species up by id', () => {
    expect(getSpecies('java-fern')?.scientific).toBe('Microsorum pteropus')
    expect(getSpecies('nope')).toBeUndefined()
    expect(getSpecies(null)).toBeUndefined()
  })

  it('formats ranges, with Fahrenheit next to Celsius', () => {
    expect(formatTemp([22, 28])).toBe('22–28 °C (72–82 °F)')
    expect(formatPh([6, 7.5])).toBe('6.0–7.5')
  })

  it('filters by text on names, scientific names and aliases', () => {
    expect(filterSpecies({ query: 'SWORD' }).map((s) => s.id)).toEqual(['amazon-sword'])
    expect(filterSpecies({ query: 'egeria' }).map((s) => s.id)).toEqual(['anacharis'])
    expect(filterSpecies({ query: 'zzz' })).toEqual([])
  })

  it('combines the picker filters', () => {
    const easyLow = filterSpecies({ easyOnly: true, lowLight: true })
    expect(easyLow.length).toBeGreaterThan(0)
    expect(easyLow.every((s) => s.difficulty === 'easy' && s.light === 'low')).toBe(true)
    const betta = filterSpecies({ bettaFriendly: true })
    expect(betta.some((s) => s.id === 'anacharis')).toBe(false)
    const floating = filterSpecies({ placement: 'floating' })
    expect(floating.map((s) => s.id).sort()).toEqual(['amazon-frogbit', 'hornwort', 'salvinia'])
    expect(filterSpecies({ placement: 'foreground', easyOnly: true, query: 'moss' })).toEqual([
      expect.objectContaining({ id: 'marimo-moss-ball' }),
    ])
  })
})
