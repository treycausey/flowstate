/** Transaction errors and versionchange handling, on a fresh database. */
import 'fake-indexeddb/auto'
import { errorText } from '@/lib/errors'

function openAt(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aquarium', version)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('transaction errors', () => {
  afterEach(() => jest.restoreAllMocks())

  it('deletePlant and importDump reject with readable text when the transaction error is null', async () => {
    jest.resetModules()
    const idb = await import('@/lib/idb-browser')
    await idb.listTanks() // open the connection first
    const real = IDBDatabase.prototype.transaction
    jest.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (
      this: IDBDatabase,
      ...args: Parameters<typeof real>
    ) {
      const t = real.apply(this, args)
      // Fire an error event whose request and transaction both carry no error. A microtask runs
      // after the caller sets its handlers but before fake-indexeddb can commit (a timer raced it)
      queueMicrotask(() => {
        t.onerror?.call(t, { target: { error: null } } as unknown as Event)
      })
      return t
    } as typeof real)
    const del = await idb.deletePlant('nope').then(
      () => null,
      (e) => e,
    )
    expect(del).toBeInstanceOf(Error)
    expect(errorText(del)).toBe('Storage error')
    const imp = await idb.importDump({ tanks: [], readings: [], plants: [], plantChecks: [] }).then(
      () => null,
      (e) => e,
    )
    expect(errorText(imp)).toBe('Storage error')
  })

  it('closes its connection on versionchange so a newer tab can upgrade', async () => {
    jest.resetModules()
    const idb = await import('@/lib/idb-browser')
    await idb.listTanks()
    const newer = await openAt(12)
    expect(newer.version).toBe(12)
    newer.close()
    // A later call reopens at its own version, which is now too old
    await expect(idb.listTanks()).rejects.toThrow('Flowstate was updated. Reload this tab.')
  })
})
