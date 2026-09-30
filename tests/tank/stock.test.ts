import { MAX_CREATURES, parseStockParam, planStock, stockEntry } from '@/lib/tank/stock'
import { Livestock } from '@/lib/tank/livestock'
import { SPECIES } from '@/lib/tank/species'

const e = stockEntry

describe('planStock', () => {
  it('shows the betta alone when no stock is recorded', () => {
    const plan = planStock([])
    expect(plan.betta).toBe(true)
    expect(plan.groups).toHaveLength(0)
    expect(plan.total).toBe(1)
  })

  it('treats a stock of zero counts as no stock', () => {
    expect(planStock([e('neon-tetra', 0)]).betta).toBe(true)
  })

  it('leaves the betta out when the stock has none', () => {
    const plan = planStock([e('neon-tetra', 5)])
    expect(plan.betta).toBe(false)
    expect(plan.groups.map((g) => g.profile.id)).toEqual(['neon-tetra'])
  })

  it('keeps the betta when it is in the stock', () => {
    expect(planStock([e('betta', 1), e('panda-corydoras', 4)]).betta).toBe(true)
  })

  it.each([
    ['neon-tetra', 40, 12],
    ['panda-corydoras', 12, 6],
    ['kuhli-loach', 9, 3],
    ['otocinclus', 9, 4],
    ['cherry-shrimp', 30, 8],
    ['nerite-snail', 9, 4],
  ])('caps %s at its render limit and represents the rest', (id, recorded, cap) => {
    const g = planStock([e(id, recorded)]).groups[0]
    expect(g.render).toBe(cap)
    expect(g.recorded).toBe(recorded)
  })

  it('never draws more than the total cap, dropping crawlers before schools', () => {
    const stock = [
      e('betta', 1),
      e('neon-tetra', 12),
      e('ember-tetra', 12),
      e('chili-rasbora', 12),
      e('panda-corydoras', 6),
      e('cherry-shrimp', 8),
      e('nerite-snail', 4),
    ]
    const plan = planStock(stock)
    expect(plan.total).toBeLessThanOrEqual(MAX_CREATURES)
    const ids = plan.groups.map((g) => g.profile.id)
    expect(ids).toEqual(expect.arrayContaining(['neon-tetra', 'ember-tetra', 'chili-rasbora']))
    const small = planStock(stock, 20)
    expect(small.total).toBeLessThanOrEqual(20)
    expect(small.betta).toBe(true)
    expect(small.groups.find((g) => g.profile.id === 'nerite-snail')).toBeUndefined()
  })

  it('stands in for unknown species by kind and zone', () => {
    const plan = planStock([
      { speciesId: null, count: 3, kind: 'fish', zone: 'bottom' },
      { speciesId: 'mystery-fish', count: 2, kind: 'shrimp', zone: 'surfaces' },
    ])
    expect(plan.groups.map((g) => g.profile.model).sort()).toEqual(['bottom', 'crawler'])
  })
})

describe('species table', () => {
  it('sizes creatures from their length relative to the betta', () => {
    expect(SPECIES['neon-tetra'].lengthCm / 6).toBeGreaterThan(0.4)
    expect(SPECIES['neon-tetra'].lengthCm / 6).toBeLessThan(0.5)
    expect(SPECIES['chili-rasbora'].lengthCm).toBeCloseTo(1.8)
    expect(SPECIES['kuhli-loach'].lengthCm).toBeGreaterThan(8)
    expect(SPECIES['kuhli-loach'].ratio).toBeLessThan(0.2)
  })

  it('parses the dev stock parameter', () => {
    expect(parseStockParam('neon-tetra:10,nope:3,panda-corydoras:x')).toEqual([
      stockEntry('neon-tetra', 10),
    ])
  })
})

describe('Livestock', () => {
  it('draws only the betta for an empty stock', () => {
    const live = new Livestock(1)
    const f = live.step(1 / 30)
    expect(f.betta).not.toBeNull()
    expect(f.creatures).toHaveLength(0)
  })

  it('draws no betta when the stock has none', () => {
    const live = new Livestock(1, {}, [e('neon-tetra', 6)])
    let f = live.frame()
    for (let i = 0; i < 30; i++) f = live.step(1 / 30)
    expect(f.betta).toBeNull()
    expect(f.creatures.length).toBeGreaterThan(0)
  })

  it('swaps the stock without rebuilding the betta', () => {
    const live = new Livestock(1, {}, [e('betta', 1)])
    const before = live.betta
    live.setStock([e('betta', 1), e('panda-corydoras', 4)])
    expect(live.betta).toBe(before)
    live.setStock([e('neon-tetra', 6)])
    expect(live.betta).toBeNull()
  })

  it('draws a honey gourami with the betta sim but no flare', () => {
    const live = new Livestock(1, {}, [e('honey-gourami', 1)])
    live.flare()
    const f = live.step(1 / 30)
    expect(f.creatures.map((c) => c.species)).toEqual(['honey-gourami'])
    expect(f.betta).toBeNull()
  })
})
