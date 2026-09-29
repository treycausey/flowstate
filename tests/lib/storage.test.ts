import 'fake-indexeddb/auto'
import {
  addReading,
  createTank,
  ensureSeed,
  exportDump,
  findMostRecentReading,
  importDump,
  listReadingsByTank,
  listReadingsWithinHour,
  listTanks,
} from '@/lib/idb'

const values = { pH: 7, ammonia: 0, nitrite: 0, nitrate: 5 }

describe('storage entrypoint', () => {
  it('seeds exactly one tank when called concurrently', async () => {
    const [a, b] = await Promise.all([ensureSeed(), ensureSeed()])
    expect(a.id).toBe(b.id)
    expect(await listTanks()).toHaveLength(1)
  })

  it('stores UTC timestamps and orders readings chronologically across offsets', async () => {
    const tank = await createTank('Offsets')
    // 09:00 at -08:00 is 17:00Z, later than 12:00Z even though it sorts earlier as text
    await addReading({ tankId: tank.id, ts: '2024-01-01T09:00:00.000-08:00', ...values })
    await addReading({ tankId: tank.id, ts: '2024-01-01T12:00:00.000Z', ...values })
    const rows = await listReadingsByTank(tank.id)
    expect(rows.map((r) => r.ts)).toEqual(['2024-01-01T12:00:00.000Z', '2024-01-01T17:00:00.000Z'])
    expect((await findMostRecentReading(tank.id))?.ts).toBe('2024-01-01T17:00:00.000Z')
  })

  it('duplicate guard matches regardless of the offset used to query', async () => {
    const tank = await createTank('Dupes')
    const saved = await addReading({
      tankId: tank.id,
      ts: '2024-02-01T10:00:00.000-05:00',
      ...values,
    })
    expect(await listReadingsWithinHour(tank.id, '2024-02-01T15:20:00.000Z')).toHaveLength(1)
    expect(await listReadingsWithinHour(tank.id, '2024-02-01T10:20:00.000-05:00')).toHaveLength(1)
    expect(await listReadingsWithinHour(tank.id, saved.ts, saved.id)).toHaveLength(0)
    expect(await listReadingsWithinHour(tank.id, '2024-02-01T17:00:00.000Z')).toHaveLength(0)
  })

  it('rejects an invalid backup without writing anything', async () => {
    const before = await exportDump()
    await expect(
      importDump({
        tanks: [{ id: 'new', name: 'New', createdAt: '2024-01-01T00:00:00.000Z' }],
        readings: [{ id: 'x', tankId: 'new', ts: 'bad', ...values }],
      }),
    ).rejects.toThrow()
    const after = await exportDump()
    expect(after.tanks).toHaveLength(before.tanks.length)
    expect(after.readings).toHaveLength(before.readings.length)
  })

  it('round-trips a backup', async () => {
    const dump = await exportDump()
    const extra = {
      tanks: [
        ...dump.tanks,
        { id: 'imp', name: 'Imported', createdAt: '2030-01-01T00:00:00.000Z' },
      ],
      readings: [
        ...dump.readings,
        { id: 'imp-r', tankId: 'imp', ts: '2024-03-01T00:00:00.000Z', ...values },
      ],
    }
    await importDump(extra)
    const tanks = await listTanks()
    expect(tanks[tanks.length - 1].name).toBe('Imported')
    expect(await listReadingsByTank('imp')).toHaveLength(1)
  })
})
