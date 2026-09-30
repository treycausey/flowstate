/** Opening the database: blocked upgrades, version mismatches, and null transaction errors. */
import 'fake-indexeddb/auto'
import { errorText, storageError } from '@/lib/errors'

function openAt(version: number, onUpgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aquarium', version)
    req.onupgradeneeded = () => onUpgrade?.(req.result)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('error text', () => {
  it('never prints null or undefined', () => {
    for (const bad of [null, undefined, {}, '']) {
      expect(errorText(bad)).toBe('Storage error')
      expect(storageError(bad, null).message).toBe('Storage error')
    }
    expect(errorText(new Error('boom'))).toBe('boom')
    expect(storageError(null, new Error('second')).message).toBe('second')
  })
})

describe('openDB failures', () => {
  afterEach(() => jest.resetModules())

  it('reports a v1 connection that blocks the upgrade, and closes the late connection', async () => {
    const old = await openAt(1, (db) => db.createObjectStore('tanks', { keyPath: 'id' }))
    // Version 1 code had no versionchange handler, so the upgrade stays blocked
    const idb = await import('@/lib/idb-browser')
    await expect(idb.listTanks()).rejects.toThrow(
      'Flowstate is open in another tab. Close it and reload.',
    )
    // Once the other tab closes, the pending open finishes; the app must retry cleanly
    old.close()
    await new Promise((r) => setTimeout(r, 20))
    await expect(idb.listTanks()).resolves.toEqual([])
    const db = await openAt(3)
    expect(db.version).toBe(3)
    db.close()
  })

  it('maps a VersionError to a reload message', async () => {
    jest.resetModules()
    const newer = await openAt(9)
    newer.close()
    const idb = await import('@/lib/idb-browser')
    await expect(idb.listTanks()).rejects.toThrow('Flowstate was updated. Reload this tab.')
  })
})
