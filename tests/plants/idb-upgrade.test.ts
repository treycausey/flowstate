/**
 * Upgrading an existing browser database (version 1: tanks, readings, settings) to the version
 * that adds plants must keep every existing row. This file owns its IndexedDB instance, so the
 * v1 database is built by hand before the app code first opens it.
 */
import 'fake-indexeddb/auto'

function openV1(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aquarium', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('tanks', { keyPath: 'id' })
      const readings = db.createObjectStore('readings', { keyPath: 'id' })
      readings.createIndex('by_tank', 'tankId', { unique: false })
      readings.createIndex('by_tank_ts', ['tankId', 'ts'], { unique: false })
      db.createObjectStore('settings', { keyPath: 'key' })
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

describe('IndexedDB upgrade from version 1', () => {
  it('keeps tanks, readings and settings, and adds working plant stores', async () => {
    const v1 = await openV1()
    expect(v1.version).toBe(1)
    expect(v1.objectStoreNames.contains('plants')).toBe(false)
    await put(v1, 'tanks', {
      id: 't-old',
      name: 'Old tank',
      createdAt: '2025-09-01T00:00:00.000Z',
      archivedAt: null,
      reminderCadence: 3,
    })
    await put(v1, 'readings', {
      id: 'r-old',
      tankId: 't-old',
      ts: '2025-09-02T10:00:00.000Z',
      pH: 7.2,
      ammonia: 0,
      nitrite: 0,
      nitrate: 10,
      note: 'from before plants',
    })
    await put(v1, 'settings', { key: 'global', value: { theme: 'dark', hemisphere: 'south' } })
    v1.close()

    // First open through the app code runs the upgrade
    const idb = await import('@/lib/idb')
    const tanks = await idb.listTanks()
    expect(tanks.map((t) => t.id)).toEqual(['t-old'])
    expect(tanks[0].reminderCadence).toBe(3)
    const readings = await idb.listReadingsByTank('t-old')
    expect(readings).toHaveLength(1)
    expect(readings[0]).toMatchObject({ id: 'r-old', pH: 7.2, note: 'from before plants' })
    expect(await idb.getSettings()).toEqual({ theme: 'dark', hemisphere: 'south' })

    // The new stores work on the upgraded database
    expect(await idb.listPlantsByTank('t-old')).toEqual([])
    const plant = await idb.addPlant({
      tankId: 't-old',
      speciesId: 'anubias-nana',
      name: 'Anubias nana',
      placement: 'epiphyte',
      plantedAt: '2026-01-01T00:00:00.000Z',
    })
    await idb.addPlantCheck({
      plantId: plant.id,
      tankId: 't-old',
      ts: '2026-01-05T00:00:00.000Z',
      health: 'thriving',
      symptoms: [],
    })
    expect(await idb.listPlantsByTank('t-old')).toHaveLength(1)
    expect(await idb.listPlantChecksByTank('t-old')).toHaveLength(1)

    // And the database really is at the new version, with the indexes the queries use
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('aquarium')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    expect(db.version).toBe(2)
    expect([...db.objectStoreNames].sort()).toEqual(
      ['plantChecks', 'plants', 'readings', 'settings', 'tanks'].sort(),
    )
    const checks = db.transaction('plantChecks').objectStore('plantChecks')
    expect([...checks.indexNames].sort()).toEqual(['by_plant', 'by_tank'])
    db.close()
  })
})
