/**
 * Upgrading a version 2 browser database (tanks, readings, settings, plants, plantChecks) to the
 * version that adds stock must keep every existing row. This file owns its IndexedDB instance,
 * so the v2 database is built by hand before the app code first opens it.
 */
import 'fake-indexeddb/auto'

function openV2(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aquarium', 2)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('tanks', { keyPath: 'id' })
      const readings = db.createObjectStore('readings', { keyPath: 'id' })
      readings.createIndex('by_tank', 'tankId', { unique: false })
      readings.createIndex('by_tank_ts', ['tankId', 'ts'], { unique: false })
      db.createObjectStore('settings', { keyPath: 'key' })
      const plants = db.createObjectStore('plants', { keyPath: 'id' })
      plants.createIndex('by_tank', 'tankId', { unique: false })
      const checks = db.createObjectStore('plantChecks', { keyPath: 'id' })
      checks.createIndex('by_tank', 'tankId', { unique: false })
      checks.createIndex('by_plant', 'plantId', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function put(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

describe('IndexedDB upgrade from version 2', () => {
  it('keeps readings, plants and settings, and adds working stock stores', async () => {
    const v2 = await openV2()
    expect(v2.version).toBe(2)
    await put(v2, 'tanks', {
      id: 't-old',
      name: 'Old tank',
      createdAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderCadence: 3,
    })
    await put(v2, 'readings', {
      id: 'r-old',
      tankId: 't-old',
      ts: '2026-01-02T10:00:00.000Z',
      pH: 7.2,
      ammonia: null,
      nitrite: 0,
      nitrate: 10,
      note: 'from before stock',
    })
    await put(v2, 'plants', {
      id: 'p-old',
      tankId: 't-old',
      speciesId: 'anubias-nana',
      name: 'Anubias nana',
      placement: 'epiphyte',
      plantedAt: '2026-01-03T00:00:00.000Z',
      removedAt: null,
    })
    await put(v2, 'plantChecks', {
      id: 'c-old',
      plantId: 'p-old',
      tankId: 't-old',
      ts: '2026-01-05T00:00:00.000Z',
      health: 'thriving',
      symptoms: [],
    })
    await put(v2, 'settings', { key: 'global', value: { theme: 'dark' } })
    v2.close()

    // First open through the app code runs the upgrade
    const idb = await import('@/lib/idb')
    const tanks = await idb.listTanks()
    expect(tanks.map((t) => t.id)).toEqual(['t-old'])
    expect(tanks[0].volumeL).toBeUndefined()
    expect(await idb.listReadingsByTank('t-old')).toMatchObject([
      { id: 'r-old', pH: 7.2, ammonia: null, note: 'from before stock' },
    ])
    expect(await idb.listPlantsByTank('t-old')).toHaveLength(1)
    expect(await idb.listPlantChecksByTank('t-old')).toHaveLength(1)
    expect(await idb.getSettings()).toEqual({ theme: 'dark' })

    // The new stores work on the upgraded database
    expect(await idb.listStockByTank('t-old')).toEqual([])
    const group = await idb.addStock({
      tankId: 't-old',
      speciesId: 'neon-tetra',
      name: 'Neon tetra',
      count: 6,
      addedAt: '2026-02-01T00:00:00.000Z',
    })
    await idb.addStockEvent({
      tankId: 't-old',
      stockId: group.id,
      ts: '2026-02-02T00:00:00.000Z',
      kind: 'lost',
      countDelta: 1,
    })
    expect((await idb.listStockByTank('t-old'))[0].count).toBe(5)
    await idb.setTankVolume('t-old', 40)
    expect((await idb.listTanks())[0].volumeL).toBe(40)

    // And the database really is at the new version, with the indexes the queries use
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('aquarium')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    expect(db.version).toBe(3)
    const events = db.transaction('stockEvents').objectStore('stockEvents')
    expect([...events.indexNames].sort()).toEqual(['by_stock', 'by_tank'])
    const stock = db.transaction('stock').objectStore('stock')
    expect([...stock.indexNames]).toEqual(['by_tank'])
    db.close()
  })
})
