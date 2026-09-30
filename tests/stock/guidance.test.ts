import type { StockEvent, StockGroup } from '@/lib/models'
import { applyStockEvent } from '@/lib/stock/apply'
import { fedToday, lastFedAt, latestHealthByGroup } from '@/lib/stock/feeding'
import {
  activeGroups,
  animalCount,
  flagsForGroup,
  groupFlags,
  rangeFlags,
  stockingEstimate,
  tankFlags,
} from '@/lib/stock/guidance'
import { stockSpecies } from '@/lib/stock/catalog'
import { tempRangeText } from '@/lib/stock/format'
import { stockForTank } from '@/lib/stock/forTank'
import { summarizeStock } from '@/lib/stock/summary'

let n = 0
function group(speciesId: string | null, count: number, extra: Partial<StockGroup> = {}) {
  n += 1
  return {
    id: `g${n}`,
    tankId: 't1',
    speciesId,
    name: speciesId ?? 'Mystery pleco',
    count,
    addedAt: '2026-09-01T00:00:00.000Z',
    removedAt: null,
    ...extra,
  } as StockGroup
}

const texts = (flags: { text: string }[]) => flags.map((f) => f.text)

describe('schooling', () => {
  it('flags a group below the species minimum', () => {
    const neons = group('neon-tetra', 3)
    const flags = groupFlags({ groups: [neons] })
    expect(texts(flags)).toEqual(['Neon tetras are calmer in groups of 6 or more.'])
    expect(flags[0]).toMatchObject({ level: 'caution', groupIds: [neons.id] })
  })

  it('does not flag a full group, a solitary species or a custom one', () => {
    const groups = [group('neon-tetra', 6), group('honey-gourami', 1), group(null, 1)]
    expect(groupFlags({ groups })).toEqual([])
  })

  it('ignores groups that have left the tank', () => {
    const gone = group('neon-tetra', 2, { removedAt: '2026-09-10T00:00:00.000Z' })
    const empty = group('neon-tetra', 0)
    expect(groupFlags({ groups: [gone, empty] })).toEqual([])
  })
})

describe('betta compatibility', () => {
  it('flags tankmates by how a betta treats them', () => {
    const betta = group('betta', 1)
    const guppies = group('guppy', 4)
    const gourami = group('honey-gourami', 1)
    const cories = group('panda-corydoras', 6)
    const shrimp = group('cherry-shrimp', 6)
    const flags = groupFlags({ groups: [betta, guppies, gourami, cories, shrimp] })
    const guppyFlag = flagsForGroup(flags, guppies.id)[0]
    expect(guppyFlag.level).toBe('danger')
    expect(guppyFlag.text).toMatch(/poor match/)
    expect(guppyFlag.text).toMatch(/nipped/)
    expect(flagsForGroup(flags, gourami.id)[0].level).toBe('caution')
    expect(flagsForGroup(flags, shrimp.id)[0].level).toBe('caution')
    expect(flagsForGroup(flags, cories.id)).toEqual([])
    expect(flagsForGroup(flags, betta.id)).toEqual([])
  })

  it('does not flag anything for a betta-free tank', () => {
    const flags = groupFlags({ groups: [group('guppy', 4), group('cherry-shrimp', 6)] })
    expect(flags).toEqual([])
  })

  it('flags a second betta as a poor match', () => {
    const a = group('betta', 1)
    const b = group('betta', 1)
    const flags = groupFlags({ groups: [a, b] })
    const multiple = flags.find((f) => f.id === 'betta:multiple')
    expect(multiple?.level).toBe('danger')
    expect(multiple?.groupIds).toEqual([a.id, b.id])
    expect(multiple?.text).toMatch(/males fight/)
    // One group of two counts too
    expect(groupFlags({ groups: [group('betta', 2)] }).map((f) => f.id)).toContain('betta:multiple')
  })
})

describe('water fit', () => {
  it('names the limiting species and the shared range', () => {
    const flags = tankFlags({
      groups: [group('honey-gourami', 1), group('kuhli-loach', 5)],
    })
    const temp = flags.find((f) => f.id === 'temp:shared')
    expect(temp?.level).toBe('info')
    expect(temp?.text).toContain('Kuhli loaches prefer 24–30 °C (75–86 °F)')
    expect(temp?.text).toContain('honey gouramis prefer 22–28 °C (72–82 °F)')
    expect(temp?.text).toContain('aim for 24–28 °C (75–82 °F)')
  })

  it('warns when the ranges do not overlap', () => {
    const fake = (id: string, name: string, tempC: [number, number]) => {
      const species = { ...stockSpecies('neon-tetra')!, id, name, tempC }
      return { group: group(id, 6), species }
    }
    const flags = rangeFlags(
      [fake('cold', 'Cold fish', [15, 20]), fake('warm', 'Warm fish', [26, 30])],
      (s) => s.tempC,
      { id: 'temp', name: 'temperature', show: tempRangeText, aim: tempRangeText },
    )
    expect(flags).toHaveLength(1)
    expect(flags[0].level).toBe('caution')
    expect(flags[0].text).toMatch(/Warm fishs prefer 26–30 °C.*cold fishs prefer 15–20 °C/)
    expect(flags[0].text).toMatch(/No single temperature suits both/)
    expect(flags[0].groupIds).toHaveLength(2)
  })

  it('shares a narrow range across catalog species, and a single point for pH', () => {
    const temp = tankFlags({
      groups: [group('platy', 6), group('kuhli-loach', 5), group('cardinal-tetra', 6)],
    }).find((f) => f.id === 'temp:shared')
    expect(temp?.text).toContain('aim for 24–26 °C')
    const ph = tankFlags({ groups: [group('cardinal-tetra', 6), group('platy', 4)] }).find(
      (f) => f.id === 'ph-range:shared',
    )
    expect(ph?.text).toContain('aim for about pH 7.0')
  })

  it('says nothing for one species, or identical ranges', () => {
    expect(tankFlags({ groups: [group('neon-tetra', 6)] })).toEqual([])
    expect(tankFlags({ groups: [group('neon-tetra', 6), group('neon-tetra', 6)] })).toEqual([])
  })

  it('compares the latest pH reading with each species', () => {
    const cardinals = group('cardinal-tetra', 6)
    const flags = groupFlags({ groups: [cardinals], latestPH: 7.8 })
    expect(flags).toHaveLength(1)
    expect(flags[0].text).toMatch(/last pH reading was 7\.8/)
    expect(flags[0].text).toMatch(/pH 5\.5–7\.0/)
    expect(groupFlags({ groups: [cardinals], latestPH: 6.5 })).toEqual([])
    expect(groupFlags({ groups: [cardinals], latestPH: null })).toEqual([])
  })
})

describe('stocking estimate', () => {
  it('is null without a volume or without animals', () => {
    expect(stockingEstimate([group('neon-tetra', 6)], null)).toBeNull()
    expect(stockingEstimate([group('neon-tetra', 6)], 0)).toBeNull()
    expect(stockingEstimate([], 60)).toBeNull()
  })

  it('rates light, moderate and heavy with hedged text', () => {
    const light = stockingEstimate([group('neon-tetra', 4)], 60)
    const moderate = stockingEstimate([group('neon-tetra', 8)], 60)
    const heavy = stockingEstimate([group('neon-tetra', 20)], 60)
    expect(light?.level).toBe('light')
    expect(moderate?.level).toBe('moderate')
    expect(heavy?.level).toBe('heavy')
    expect(light?.text).toMatch(/rough guide, not a rule/)
    expect(light?.text).toMatch(/filtration/)
    expect(light?.text).toMatch(/water changes/)
    expect(heavy?.text).toMatch(/filtration/)
    expect(heavy?.text).toMatch(/water changes/)
    expect(light?.text).toContain('60 L (about 15.9 US gal)')
  })

  it('uses 4 L per load unit and rates realistic betta and community tanks', () => {
    expect(stockingEstimate([group('betta', 1)], 20)?.level).toBe('light')
    expect(
      stockingEstimate(
        [group('betta', 1), group('pygmy-corydoras', 6), group('cherry-shrimp', 5)],
        40,
      )?.level,
    ).toBe('moderate')
    expect(
      stockingEstimate(
        [
          group('neon-tetra', 10),
          group('panda-corydoras', 6),
          group('otocinclus', 3),
          group('cherry-shrimp', 5),
          group('nerite-snail', 2),
        ],
        60,
      )?.level,
    ).toBe('heavy')
  })

  it('weights by species and counts custom animals as one unit each', () => {
    const cories = stockingEstimate([group('bronze-corydoras', 4)], 60)
    expect(cories?.load).toBe(10)
    expect(stockingEstimate([group(null, 3)], 60)?.load).toBe(3)
    // Removed groups do not count
    expect(
      stockingEstimate(
        [
          group('neon-tetra', 40, { removedAt: '2026-09-02T00:00:00.000Z' }),
          group('neon-tetra', 2),
        ],
        60,
      )?.level,
    ).toBe('light')
  })
})

describe('feeding and health', () => {
  const fed = (ts: string): StockEvent => ({
    id: ts,
    tankId: 't1',
    stockId: null,
    ts,
    kind: 'fed',
  })

  it('reads the last fed time from fed events only', () => {
    const events: StockEvent[] = [
      fed('2026-09-20T07:00:00.000Z'),
      fed('2026-09-21T07:30:00.000Z'),
      { id: 'o', tankId: 't1', stockId: 'g', ts: '2026-09-22T00:00:00.000Z', kind: 'observed' },
    ]
    expect(lastFedAt(events)?.toISOString()).toBe('2026-09-21T07:30:00.000Z')
    expect(lastFedAt([])).toBeNull()
  })

  it('knows whether the tank was fed today in local time', () => {
    const now = new Date(2026, 8, 21, 20, 0)
    const morning = new Date(2026, 8, 21, 8, 10).toISOString()
    const yesterday = new Date(2026, 8, 20, 22, 0).toISOString()
    expect(fedToday([fed(morning)], now)).toBe(true)
    expect(fedToday([fed(yesterday)], now)).toBe(false)
    expect(fedToday([], now)).toBe(false)
  })

  it('keeps the newest health state per group', () => {
    const events: StockEvent[] = [
      {
        id: 'a',
        tankId: 't1',
        stockId: 'g1',
        ts: '2026-09-01T00:00:00.000Z',
        kind: 'health',
        health: 'sick',
      },
      {
        id: 'b',
        tankId: 't1',
        stockId: 'g1',
        ts: '2026-09-05T00:00:00.000Z',
        kind: 'health',
        health: 'ok',
      },
      { id: 'c', tankId: 't1', stockId: 'g1', ts: '2026-09-06T00:00:00.000Z', kind: 'observed' },
    ]
    expect(latestHealthByGroup(events).get('g1')?.health).toBe('ok')
  })
})

describe('applyStockEvent', () => {
  const base = group('neon-tetra', 6)
  const event = (kind: StockEvent['kind'], countDelta?: number): StockEvent => ({
    id: 'e',
    tankId: 't1',
    stockId: base.id,
    ts: '2026-09-20T08:00:00.000Z',
    kind,
    ...(countDelta === undefined ? {} : { countDelta }),
  })

  it('subtracts lost and rehomed, adds added, and stores the applied delta', () => {
    expect(applyStockEvent(base, event('lost', 2)).group.count).toBe(4)
    expect(applyStockEvent(base, event('lost', 2)).event.countDelta).toBe(-2)
    expect(applyStockEvent(base, event('rehomed', 1)).group.count).toBe(5)
    expect(applyStockEvent(base, event('added', 3)).group.count).toBe(9)
    expect(applyStockEvent(base, event('added', 3)).event.countDelta).toBe(3)
  })

  it('never goes below zero and removes an emptied group', () => {
    const out = applyStockEvent(base, event('lost', 50))
    expect(out.group.count).toBe(0)
    expect(out.event.countDelta).toBe(-6)
    expect(out.group.removedAt).toBe('2026-09-20T08:00:00.000Z')
    const back = applyStockEvent(out.group, event('added', 2))
    expect(back.group.count).toBe(2)
    expect(back.group.removedAt).toBeNull()
  })

  it('leaves the group alone for observations and rejects a missing count', () => {
    expect(applyStockEvent(base, event('observed')).group).toBe(base)
    expect(() => applyStockEvent(base, event('lost'))).toThrow(/how many/i)
    expect(() => applyStockEvent(base, event('lost', 0))).toThrow(/how many/i)
    expect(() => applyStockEvent(base, event('lost', 1.5))).toThrow(/how many/i)
  })
})

describe('tank hook data', () => {
  it('lists only active groups with zone and kind', () => {
    const groups = [
      group('neon-tetra', 6),
      group('cherry-shrimp', 4),
      group('nerite-snail', 1),
      group(null, 2),
      group('guppy', 3, { removedAt: '2026-09-02T00:00:00.000Z' }),
      group('otocinclus', 0),
    ]
    expect(stockForTank(groups)).toEqual([
      { speciesId: 'neon-tetra', count: 6, zone: 'middle', kind: 'fish' },
      { speciesId: 'cherry-shrimp', count: 4, zone: 'surfaces', kind: 'shrimp' },
      { speciesId: 'nerite-snail', count: 1, zone: 'surfaces', kind: 'snail' },
      { speciesId: null, count: 2, zone: 'middle', kind: 'fish' },
    ])
  })
})

describe('summary', () => {
  it('counts animals and groups and gathers flags', () => {
    const groups = [group('betta', 1), group('guppy', 4), group('neon-tetra', 3)]
    const summary = summarizeStock({
      groups,
      events: [],
      volumeL: 60,
      now: new Date(),
    })
    expect(summary.animals).toBe(8)
    expect(animalCount(groups)).toBe(8)
    expect(activeGroups(groups)).toHaveLength(3)
    expect(summary.fedToday).toBe(false)
    expect(summary.groupFlags.length).toBeGreaterThanOrEqual(2)
    expect(summary.estimate).not.toBeNull()
  })
})
