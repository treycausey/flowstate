// Polyfill IndexedDB for Jest
import 'fake-indexeddb/auto'
import { createTank, listTanks, addReading, listReadingsByTankInRange, ensureSeed } from '@/lib/idb'

describe('IndexedDB helpers', () => {
  it('seeds first tank when none exists', async () => {
    const seeded = await ensureSeed()
    expect(seeded.name).toBe('My Tank')
    const tanks = await listTanks()
    expect(tanks.length).toBe(1)
  })

  it('creates a tank and logs a reading', async () => {
    const tank = await createTank('Test Tank')
    const ts = new Date().toISOString()
    await addReading({
      tankId: tank.id,
      ts,
      pH: 7.0,
      ammonia: 0,
      nitrite: 0,
      nitrate: 10,
      note: 'baseline',
    })
    const results = await listReadingsByTankInRange(tank.id, '1970-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z')
    expect(results.length).toBe(1)
    expect(results[0].note).toBe('baseline')
  })
})

