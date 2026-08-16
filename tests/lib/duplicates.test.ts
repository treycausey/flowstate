import 'fake-indexeddb/auto'
import { addReading, ensureSeed, listReadingsWithinHour, updateReading } from '@/lib/idb'

describe('duplicates and updates', () => {
  it('detects readings within an hour', async () => {
    const tank = await ensureSeed()
    const base = new Date('2024-01-01T12:00:00.000Z')
    await addReading({
      tankId: tank.id,
      ts: base.toISOString(),
      pH: 7,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
    })
    const near = await listReadingsWithinHour(
      tank.id,
      new Date(base.getTime() + 20 * 60000).toISOString(),
    )
    expect(near.length).toBe(1)
  })

  it('updates reading values', async () => {
    const tank = await ensureSeed()
    const r = await addReading({
      tankId: tank.id,
      ts: new Date().toISOString(),
      pH: 7,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
    })
    r.pH = 7.2
    await updateReading(r)
    const again = await listReadingsWithinHour(tank.id, r.ts)
    expect(again[0].pH).toBe(7.2)
  })
})
