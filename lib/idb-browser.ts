import { type Reading, type Settings, type Tank, type Dump } from './models'

const DB_NAME = 'aquarium'
const DB_VERSION = 1

type Stores = 'tanks' | 'readings' | 'settings'

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function openDB(): Promise<IDBDatabase> {
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
    }
    req.onsuccess = () => resolve(req.result)
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

// Seed/init: create first tank if none exists
export async function ensureSeed(): Promise<Tank> {
  const tanks = await listTanks()
  if (tanks.length > 0) return tanks[0]
  return createTank('My Tank')
}

export async function exportDump(): Promise<Dump> {
  const [tanks, readings, settings] = await Promise.all([
    getAll<Tank>('tanks'),
    getAll<Reading>('readings'),
    getSettings(),
  ])
  return { tanks, readings, settings }
}

export async function importDump(dump: Dump): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['tanks', 'readings', 'settings'], 'readwrite')
    const tanks = tx.objectStore('tanks')
    const readings = tx.objectStore('readings')
    const settings = tx.objectStore('settings')
    ;(async () => {
      try {
        for (const t of dump.tanks) await reqToPromise(() => tanks.put(t))
        for (const r of dump.readings) await reqToPromise(() => readings.put(r))
        if (dump.settings)
          await reqToPromise(() => settings.put({ key: 'global', value: dump.settings }))
      } catch (e) {
        tx.abort()
        reject(e)
        return
      }
    })()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function reqToPromise<T>(fn: () => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = fn()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
