import {
  STOCK_CATALOG,
  filterStock,
  searchStock,
  speciesCountName,
  stockImageSrc,
  stockSpecies,
} from '@/lib/stock/catalog'
import { STOCK_KINDS, STOCK_ZONES } from '@/lib/stock/types'

const EXPECTED_IDS = [
  'betta',
  'neon-tetra',
  'cardinal-tetra',
  'ember-tetra',
  'rummy-nose-tetra',
  'harlequin-rasbora',
  'chili-rasbora',
  'celestial-pearl-danio',
  'guppy',
  'endler',
  'platy',
  'honey-gourami',
  'panda-corydoras',
  'bronze-corydoras',
  'pygmy-corydoras',
  'otocinclus',
  'kuhli-loach',
  'cherry-shrimp',
  'amano-shrimp',
  'nerite-snail',
  'mystery-snail',
  'ramshorn-snail',
]

describe('stock catalog integrity', () => {
  it('has exactly the 22 agreed ids, once each', () => {
    const ids = STOCK_CATALOG.map((s) => s.id)
    expect(ids).toHaveLength(22)
    expect(new Set(ids).size).toBe(22)
    expect([...ids].sort()).toEqual([...EXPECTED_IDS].sort())
  })

  it.each(STOCK_CATALOG.map((s) => [s.id, s] as const))('%s has sane values', (_id, s) => {
    expect(s.name.length).toBeGreaterThan(2)
    expect(s.scientific).toMatch(/^[A-Z][a-z]+/)
    expect(STOCK_KINDS).toContain(s.kind)
    expect(STOCK_ZONES).toContain(s.zone)
    expect(s.sizeCm).toBeGreaterThan(0.5)
    expect(s.sizeCm).toBeLessThanOrEqual(12)
    // Comfortable temperature range: ordered, inside what tropical freshwater animals tolerate
    expect(s.tempC[0]).toBeLessThan(s.tempC[1])
    expect(s.tempC[0]).toBeGreaterThanOrEqual(18)
    expect(s.tempC[1]).toBeLessThanOrEqual(31)
    expect(s.ph[0]).toBeLessThan(s.ph[1])
    expect(s.ph[0]).toBeGreaterThanOrEqual(4.5)
    expect(s.ph[1]).toBeLessThanOrEqual(8.5)
    expect(Number.isInteger(s.minGroup)).toBe(true)
    expect(s.minGroup).toBeGreaterThanOrEqual(1)
    expect(s.bioload).toBeGreaterThan(0)
    expect(s.bioload).toBeLessThanOrEqual(3)
    for (const text of [s.diet, s.care, s.notes, s.bettaReason]) {
      expect(text.length).toBeGreaterThan(20)
      expect(text).toMatch(/[.]$/)
    }
  })

  it('gives every betta-caution or -avoid species a reason', () => {
    for (const s of STOCK_CATALOG.filter((x) => x.bettaCompat !== 'good')) {
      expect(s.bettaReason.trim().length).toBeGreaterThan(20)
    }
  })

  it('keeps the agreed betta calls', () => {
    const compat = (id: string) => stockSpecies(id)?.bettaCompat
    expect(compat('guppy')).toBe('avoid')
    expect(compat('honey-gourami')).toBe('caution')
    expect(compat('cherry-shrimp')).toBe('caution')
    for (const id of ['panda-corydoras', 'bronze-corydoras', 'pygmy-corydoras']) {
      expect(compat(id)).toBe('good')
    }
  })

  it('needs groups for schooling fish and none for betta, gourami and snails', () => {
    for (const id of [
      'betta',
      'honey-gourami',
      'nerite-snail',
      'mystery-snail',
      'ramshorn-snail',
    ]) {
      expect(stockSpecies(id)?.minGroup).toBe(1)
    }
    for (const id of ['neon-tetra', 'harlequin-rasbora', 'panda-corydoras', 'kuhli-loach']) {
      expect(stockSpecies(id)!.minGroup).toBeGreaterThanOrEqual(5)
    }
  })

  it('looks animals up, names counts and points at the image path', () => {
    expect(stockSpecies('neon-tetra')?.name).toBe('Neon tetra')
    expect(stockSpecies('nope')).toBeUndefined()
    expect(stockSpecies(null)).toBeUndefined()
    expect(speciesCountName(stockSpecies('neon-tetra')!, 1)).toBe('Neon tetra')
    expect(speciesCountName(stockSpecies('neon-tetra')!, 6)).toBe('neon tetras')
    expect(speciesCountName(stockSpecies('cherry-shrimp')!, 6)).toBe('cherry shrimp')
    expect(stockImageSrc('betta')).toBe('/tank/betta-cruise.webp')
    expect(stockImageSrc('neon-tetra')).toBe('/tank/fish/neon-tetra.webp')
  })

  it('keeps fact-checked names searchable under old and new scientific names', () => {
    expect(searchStock('Corydoras panda').map((s) => s.id)).toContain('panda-corydoras')
    expect(searchStock('hoplisoma').map((s) => s.id)).toEqual(['panda-corydoras'])
    expect(searchStock('Hemigrammus rhodostomus').map((s) => s.id)).toEqual(['rummy-nose-tetra'])
    expect(searchStock('pangio kuhlii').map((s) => s.id)).toEqual(['kuhli-loach'])
    expect(searchStock('Neritina natalensis').map((s) => s.id)).toEqual(['nerite-snail'])
    expect(searchStock('mosquito fish')).toEqual([])
    expect(stockSpecies('mystery-snail')?.bettaCompat).toBe('caution')
    expect(stockSpecies('kuhli-loach')?.minGroup).toBe(6)
  })

  it('searches names, scientific names and aliases, and filters', () => {
    expect(searchStock('neon').map((s) => s.id)).toEqual(['neon-tetra'])
    expect(searchStock('Endlers').map((s) => s.id)).toEqual(['endler'])
    expect(searchStock('pomacea').map((s) => s.id)).toEqual(['mystery-snail'])
    expect(searchStock('')).toHaveLength(22)
    expect(searchStock('zzz')).toEqual([])
    expect(filterStock({ kind: 'snail' })).toHaveLength(3)
    expect(filterStock({ kind: 'shrimp' }).map((s) => s.id)).toEqual([
      'cherry-shrimp',
      'amano-shrimp',
    ])
    expect(filterStock({ bettaSafe: true }).every((s) => s.bettaCompat === 'good')).toBe(true)
    expect(filterStock({ zone: 'bottom' }).every((s) => s.zone === 'bottom')).toBe(true)
  })
})
