import {
  type Dump,
  type Plant,
  type PlantCheck,
  type Reading,
  type Settings,
  type Tank,
} from './models'

const DB_NAME = 'aquarium'
/**
 * 1: tanks, readings, settings.
 * 2: plants and plantChecks. Upgrading only adds stores, so existing data is untouched.
 */
const DB_VERSION = 2

type Stores = 'tanks' | 'readings' | 'settings' | 'plants' | 'plantChecks'

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// One shared connection per page; reopened if the browser closes it (e.g. version change)
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openFresh().catch((e) => {
      dbPromise = null
      throw e
    })
  }
  return dbPromise
}

function openFresh(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('tanks')) {
        db.createObjectStore('tanks', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('readings')) {
        const store = db.createObjectStore('readings', { keyPath: 'id' })
        store.createIndex('by_tank', 'tankId', { unique: false })
        store.createIndex('by_tank_ts', ['tankId', 'ts'], { unique: false })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('plants')) {
        const store = db.createObjectStore('plants', { keyPath: 'id' })
        store.createIndex('by_tank', 'tankId', { unique: false })
      }
      if (!db.objectStoreNames.contains('plantChecks')) {
        const store = db.createObjectStore('plantChecks', { keyPath: 'id' })
        store.createIndex('by_tank', 'tankId', { unique: false })
        store.createIndex('by_plant', 'plantId', { unique: false })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const reset = () => {
        if (dbPromise) dbPromise = null
      }
      db.onversionchange = () => {
        db.close()
        reset()
      }
      db.onclose = reset
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

function tx<T extends Stores>(db: IDBDatabase, store: T, mode: IDBTransactionMode = 'readonly') {
  return db.transaction(store, mode).objectStore(store)
}

export async function getAll<T>(store: Stores): Promise<T[]> {
  const db = await openDB()
  return new Promise<T[]>((resolve, reject) => {
    const s = tx(db, store)
    const req = s.getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

// Tanks
export async function listTanks(): Promise<Tank[]> {
  return getAll<Tank>('tanks')
}

export async function createTank(
  name: string,
  reminderCadence: number | null = null,
): Promise<Tank> {
  const tank: Tank = {
    id: uuid(),
    name,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    reminderCadence,
  }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'tanks', 'readwrite')
    const req = s.add(tank)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  return tank
}

export async function renameTank(id: string, name: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'tanks', 'readwrite')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const tank = getReq.result as Tank | undefined
      if (!tank) return reject(new Error('Tank not found'))
      tank.name = name
      const putReq = s.put(tank)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function archiveTank(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'tanks', 'readwrite')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const tank = getReq.result as Tank | undefined
      if (!tank) return reject(new Error('Tank not found'))
      tank.archivedAt = new Date().toISOString()
      const putReq = s.put(tank)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function setTankReminderCadence(id: string, days: number | null): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'tanks', 'readwrite')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const tank = getReq.result as Tank | undefined
      if (!tank) return reject(new Error('Tank not found'))
      tank.reminderCadence = days
      const putReq = s.put(tank)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// Readings
export async function addReading(input: Omit<Reading, 'id'> & { id?: string }): Promise<Reading> {
  const reading: Reading = { id: input.id ?? uuid(), ...input }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'readings', 'readwrite')
    const req = s.add(reading)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  return reading
}

export async function updateReading(reading: Reading): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'readings', 'readwrite')
    const req = s.put(reading)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function deleteReading(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'readings', 'readwrite')
    const req = s.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function listReadingsByTank(tankId: string): Promise<Reading[]> {
  const db = await openDB()
  return new Promise<Reading[]>((resolve, reject) => {
    const s = tx(db, 'readings')
    const idx = s.index('by_tank')
    const req = idx.getAll(IDBKeyRange.only(tankId))
    req.onsuccess = () =>
      resolve((req.result as Reading[]).sort((a, b) => a.ts.localeCompare(b.ts)))
    req.onerror = () => reject(req.error)
  })
}

export async function listReadingsByTankInRange(
  tankId: string,
  fromISO: string,
  toISO: string,
): Promise<Reading[]> {
  const db = await openDB()
  return new Promise<Reading[]>((resolve, reject) => {
    const s = tx(db, 'readings')
    const idx = s.index('by_tank_ts')
    const range = IDBKeyRange.bound([tankId, fromISO], [tankId, toISO])
    const req = idx.getAll(range)
    req.onsuccess = () => resolve(req.result as Reading[])
    req.onerror = () => reject(req.error)
  })
}

export async function findMostRecentReading(tankId: string): Promise<Reading | undefined> {
  const all = await listReadingsByTank(tankId)
  return all.length > 0 ? all[all.length - 1] : undefined
}

export async function listReadingsWithinHour(tankId: string, tsISO: string): Promise<Reading[]> {
  const ts = new Date(tsISO).getTime()
  const start = new Date(ts - 30 * 60 * 1000).toISOString()
  const end = new Date(ts + 30 * 60 * 1000).toISOString()
  return listReadingsByTankInRange(tankId, start, end)
}

// Settings
export async function getSettings(): Promise<Settings | undefined> {
  const db = await openDB()
  return new Promise<Settings | undefined>((resolve, reject) => {
    const s = tx(db, 'settings')
    const req = s.get('global')
    req.onsuccess = () => resolve(req.result?.value as Settings | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function setSettings(value: Settings): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const s = tx(db, 'settings', 'readwrite')
    const req = s.put({ key: 'global', value })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// Plants
export async function listPlantsByTank(tankId: string): Promise<Plant[]> {
  const db = await openDB()
  return new Promise<Plant[]>((resolve, reject) => {
    const req = tx(db, 'plants').index('by_tank').getAll(IDBKeyRange.only(tankId))
    req.onsuccess = () => resolve(req.result as Plant[])
    req.onerror = () => reject(req.error)
  })
}

export async function addPlant(input: Omit<Plant, 'id'> & { id?: string }): Promise<Plant> {
  const plant: Plant = { ...input, id: input.id ?? uuid() }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, 'plants', 'readwrite').add(plant)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  return plant
}

export async function updatePlant(plant: Plant): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, 'plants', 'readwrite').put(plant)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Deletes the plant and its checks in one transaction. */
export async function deletePlant(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(['plants', 'plantChecks'], 'readwrite')
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error('Delete aborted'))
    const checks = t.objectStore('plantChecks')
    const keys = checks.index('by_plant').getAllKeys(IDBKeyRange.only(id))
    keys.onsuccess = () => {
      for (const key of keys.result) checks.delete(key)
      t.objectStore('plants').delete(id)
    }
  })
}

export async function listPlantChecksByTank(tankId: string): Promise<PlantCheck[]> {
  const db = await openDB()
  return new Promise<PlantCheck[]>((resolve, reject) => {
    const req = tx(db, 'plantChecks').index('by_tank').getAll(IDBKeyRange.only(tankId))
    req.onsuccess = () => resolve(req.result as PlantCheck[])
    req.onerror = () => reject(req.error)
  })
}

export async function addPlantCheck(
  input: Omit<PlantCheck, 'id'> & { id?: string },
): Promise<PlantCheck> {
  const check: PlantCheck = { ...input, id: input.id ?? uuid() }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const req = tx(db, 'plantChecks', 'readwrite').add(check)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  return check
}

// Seed/init: create first tank if none exists
export async function ensureSeed(): Promise<Tank> {
  const tanks = await listTanks()
  if (tanks.length > 0) return tanks[0]
  return createTank('My Tank')
}

export async function exportDump(): Promise<Dump> {
  const [tanks, readings, plants, plantChecks, settings] = await Promise.all([
    getAll<Tank>('tanks'),
    getAll<Reading>('readings'),
    getAll<Plant>('plants'),
    getAll<PlantCheck>('plantChecks'),
    getSettings(),
  ])
  return { tanks, readings, plants, plantChecks, settings }
}

export async function importDump(dump: Dump): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      ['tanks', 'readings', 'plants', 'plantChecks', 'settings'],
      'readwrite',
    )
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Import aborted'))
    // Queue every write synchronously so the transaction cannot auto-commit mid-import
    const tanks = tx.objectStore('tanks')
    const readings = tx.objectStore('readings')
    for (const t of dump.tanks) tanks.put(t)
    for (const r of dump.readings) readings.put(r)
    const plants = tx.objectStore('plants')
    const plantChecks = tx.objectStore('plantChecks')
    for (const p of dump.plants ?? []) plants.put(p)
    for (const c of dump.plantChecks ?? []) plantChecks.put(c)
    if (dump.settings) tx.objectStore('settings').put({ key: 'global', value: dump.settings })
  })
}
