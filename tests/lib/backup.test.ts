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
