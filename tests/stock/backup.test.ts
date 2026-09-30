import { BackupFormatError, parseDump } from '@/lib/backup'

const tank = {
  id: 't1',
  name: 'Main',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  reminderCadence: 7,
  volumeL: 60,
}
const group = {
  id: 'g1',
  tankId: 't1',
  speciesId: 'neon-tetra',
  name: 'Neon tetra',
  count: 6,
  addedAt: '2026-02-01T08:00:00.000-08:00',
  removedAt: null,
  note: 'from the local shop',
}
const event = {
  id: 'e1',
  tankId: 't1',
  stockId: 'g1',
  ts: '2026-02-05T08:00:00.000-08:00',
  kind: 'lost',
  countDelta: -1,
  health: 'concern',
  note: 'one was hiding',
}
const fed = { id: 'e2', tankId: 't1', stockId: null, ts: '2026-02-06T08:00:00.000Z', kind: 'fed' }
const backup = { tanks: [tank], readings: [], stock: [group], stockEvents: [event, fed] }

describe('parseDump stock', () => {
  it('accepts stock and events, normalizes timestamps and keeps the tank volume', () => {
    const dump = parseDump(backup)
    expect(dump.tanks[0].volumeL).toBe(60)
    expect(dump.stock).toEqual([{ ...group, addedAt: '2026-02-01T16:00:00.000Z', removedAt: null }])
    expect(dump.stockEvents?.[0]).toMatchObject({
      ts: '2026-02-05T16:00:00.000Z',
      kind: 'lost',
      countDelta: -1,
      health: 'concern',
    })
    expect(dump.stockEvents?.[1]).toEqual(fed)
  })

  it('still imports a backup made before stock existed', () => {
    const dump = parseDump({ tanks: [{ ...tank, volumeL: undefined }], readings: [] })
    expect(dump.stock).toEqual([])
    expect(dump.stockEvents).toEqual([])
    expect(dump.tanks[0].volumeL).toBeUndefined()
  })

  it('drops a tank volume above 100000 L like the volume field does', () => {
    expect(
      parseDump({ tanks: [{ ...tank, volumeL: 100001 }], readings: [] }).tanks[0].volumeL,
    ).toBeUndefined()
    expect(
      parseDump({ tanks: [{ ...tank, volumeL: 100000 }], readings: [] }).tanks[0].volumeL,
    ).toBe(100000)
  })

  it('drops a nonsense tank volume instead of failing', () => {
    expect(parseDump({ tanks: [{ ...tank, volumeL: -4 }], readings: [] }).tanks[0].volumeL).toBe(
      undefined,
    )
    expect(parseDump({ tanks: [{ ...tank, volumeL: 'big' }], readings: [] }).tanks[0].volumeL).toBe(
      undefined,
    )
  })

  it('keeps custom species and emptied groups', () => {
    const dump = parseDump({
      ...backup,
      stock: [
        {
          ...group,
          id: 'g2',
          speciesId: null,
          name: 'Mystery pleco',
          count: 0,
          removedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      stockEvents: [],
    })
    expect(dump.stock?.[0]).toMatchObject({ speciesId: null, count: 0 })
    expect(dump.stock?.[0].removedAt).toBe('2026-03-01T00:00:00.000Z')
  })

  it.each([
    [
      'a group on an unknown tank',
      { ...backup, stock: [{ ...group, tankId: 'nope' }] },
      /unknown tank/,
    ],
    ['a negative count', { ...backup, stock: [{ ...group, count: -1 }] }, /invalid count/],
    ['a fractional count', { ...backup, stock: [{ ...group, count: 1.5 }] }, /invalid count/],
    [
      'a bad timestamp',
      { ...backup, stock: [{ ...group, addedAt: 'yesterday' }] },
      /invalid addedAt/,
    ],
    [
      'an unknown event kind',
      { ...backup, stockEvents: [{ ...event, kind: 'medicated' }] },
      /invalid kind/,
    ],
    [
      'a bad health value',
      { ...backup, stockEvents: [{ ...event, health: 'dead' }] },
      /invalid health/,
    ],
    [
      'an event for a missing group',
      { ...backup, stockEvents: [{ ...event, stockId: 'nope' }] },
      /unknown group/,
    ],
    [
      'an event on another tank than its group',
      {
        ...backup,
        tanks: [tank, { ...tank, id: 't2' }],
        stockEvents: [{ ...event, tankId: 't2' }],
      },
      /unknown group or tank/,
    ],
    ['stock that is not a list', { ...backup, stock: 'lots' }, /must be an array/],
  ])('rejects %s', (_label, data, message) => {
    expect(() => parseDump(data)).toThrow(BackupFormatError)
    expect(() => parseDump(data)).toThrow(message)
  })
})
