import { BackupFormatError, parseDump } from '@/lib/backup'

const tank = {
  id: 't1',
  name: 'Main',
  createdAt: '2024-01-01T00:00:00.000Z',
  archivedAt: null,
  reminderCadence: 7,
}
const reading = {
  id: 'r1',
  tankId: 't1',
  ts: '2024-01-01T08:00:00.000-08:00',
  pH: 7,
  ammonia: 0,
  nitrite: 0,
  nitrate: 5,
}

describe('parseDump', () => {
  it('accepts a valid backup and normalizes timestamps to UTC', () => {
    const dump = parseDump({ tanks: [tank], readings: [reading], settings: { theme: 'dark' } })
    expect(dump.readings[0].ts).toBe('2024-01-01T16:00:00.000Z')
    expect(dump.tanks[0].reminderCadence).toBe(7)
    expect(dump.settings).toEqual({ theme: 'dark' })
  })

  it.each([
    ['not an object', 'hello'],
    ['missing arrays', { tanks: [] }],
    ['bad metric', { tanks: [tank], readings: [{ ...reading, pH: 'seven' }] }],
    ['bad timestamp', { tanks: [tank], readings: [{ ...reading, ts: 'yesterday' }] }],
    ['orphan reading', { tanks: [tank], readings: [{ ...reading, tankId: 'nope' }] }],
    ['tank without id', { tanks: [{ name: 'x' }], readings: [] }],
  ])('rejects %s', (_label, data) => {
    expect(() => parseDump(data)).toThrow(BackupFormatError)
  })
})

describe('parseDump plants', () => {
  const plant = {
    id: 'p1',
    tankId: 't1',
    speciesId: 'java-fern',
    name: 'Java fern',
    placement: 'epiphyte',
    plantedAt: '2024-02-01T08:00:00.000-08:00',
    removedAt: null,
    note: 'on the wood',
  }
  const plantCheck = {
    id: 'c1',
    plantId: 'p1',
    tankId: 't1',
    ts: '2024-02-05T08:00:00.000-08:00',
    health: 'struggling',
    symptoms: ['pinholes', 'brown-edges'],
    action: 'trimmed',
    note: 'edges',
  }
  const backup = { tanks: [tank], readings: [reading], plants: [plant], plantChecks: [plantCheck] }

  it('accepts plants and checks and normalizes their timestamps to UTC', () => {
    const dump = parseDump(backup)
    expect(dump.plants).toEqual([
      { ...plant, plantedAt: '2024-02-01T16:00:00.000Z', removedAt: null },
    ])
    expect(dump.plantChecks?.[0]).toMatchObject({
      ts: '2024-02-05T16:00:00.000Z',
      symptoms: ['pinholes', 'brown-edges'],
      action: 'trimmed',
    })
  })

  it('still imports a backup made before plants existed', () => {
    const dump = parseDump({ tanks: [tank], readings: [reading] })
    expect(dump.plants).toEqual([])
    expect(dump.plantChecks).toEqual([])
    expect(dump.readings).toHaveLength(1)
  })

  it('keeps custom plants and removed plants', () => {
    const dump = parseDump({
      ...backup,
      plants: [{ ...plant, speciesId: null, removedAt: '2024-03-01T00:00:00Z' }],
    })
    expect(dump.plants?.[0]).toMatchObject({
      speciesId: null,
      removedAt: '2024-03-01T00:00:00.000Z',
    })
  })

  it.each([
    ['plant on an unknown tank', { plants: [{ ...plant, tankId: 'nope' }], plantChecks: [] }],
    ['plant without a name', { plants: [{ ...plant, name: '' }], plantChecks: [] }],
    ['plant with a bad placement', { plants: [{ ...plant, placement: 'sky' }], plantChecks: [] }],
    ['plant with a bad date', { plants: [{ ...plant, plantedAt: 'soon' }], plantChecks: [] }],
    ['check on an unknown plant', { plantChecks: [{ ...plantCheck, plantId: 'nope' }] }],
    ['check with a bad health', { plantChecks: [{ ...plantCheck, health: 'great' }] }],
    ['check with an unknown symptom', { plantChecks: [{ ...plantCheck, symptoms: ['smelly'] }] }],
    ['check with a bad action', { plantChecks: [{ ...plantCheck, action: 'fertilised' }] }],
    ['plants that are not a list', { plants: 'many' }],
  ])('rejects %s', (_label, extra) => {
    expect(() => parseDump({ ...backup, ...extra })).toThrow(BackupFormatError)
  })

  it('rejects a check filed under a different tank than its plant', () => {
    const other = { ...tank, id: 't2', name: 'Other' }
    expect(() =>
      parseDump({
        ...backup,
        tanks: [tank, other],
        plantChecks: [{ ...plantCheck, tankId: 't2' }],
      }),
    ).toThrow(`Plant check ${plantCheck.id} is on a different tank than its plant`)
  })
})
