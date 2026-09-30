import 'fake-indexeddb/auto'
import {
  addStock,
  addStockEvent,
  archiveTank,
  createTank,
  deleteStock,
  exportDump,
  importDump,
  listStockByTank,
  listStockEventsByTank,
  listTanks,
  setTankVolume,
  updateStock,
} from '@/lib/idb'

let counter = 0
async function setup(count = 6) {
  const tank = await createTank(`Stock tank ${++counter}`)
  const group = await addStock({
    tankId: tank.id,
    speciesId: 'neon-tetra',
    name: 'Neon tetra',
    count,
    addedAt: '2026-09-01T08:00:00+02:00',
    removedAt: null,
  })
  return { tank, group }
}

const ev = (
  tankId: string,
  stockId: string | null,
  kind: 'lost' | 'rehomed' | 'added' | 'fed' | 'observed',
  countDelta?: number,
) => ({
  tankId,
  stockId,
  ts: new Date().toISOString(),
  kind,
  ...(countDelta === undefined ? {} : { countDelta }),
})

describe('stock groups', () => {
  it('stores UTC timestamps and lists oldest added first', async () => {
    const { tank, group } = await setup()
    expect(group.addedAt).toBe('2026-09-01T06:00:00.000Z')
    await addStock({
      tankId: tank.id,
      speciesId: null,
      name: '  Mystery pleco ',
      count: 1,
      addedAt: '2026-08-01T00:00:00.000Z',
    })
    const list = await listStockByTank(tank.id)
    expect(list.map((g) => g.name)).toEqual(['Mystery pleco', 'Neon tetra'])
    expect(await listStockByTank('other-tank')).toEqual([])
  })

  it('rejects a count below 1', async () => {
    const tank = await createTank(`Stock tank ${++counter}`)
    await expect(
      addStock({
        tankId: tank.id,
        speciesId: null,
        name: 'x',
        count: 0,
        addedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/count of 1/)
    expect(await listStockByTank(tank.id)).toEqual([])
  })

  it('removes and restores without losing the group', async () => {
    const { tank, group } = await setup()
    await updateStock({ ...group, removedAt: '2026-09-10T00:00:00+00:00' })
    expect((await listStockByTank(tank.id))[0].removedAt).toBe('2026-09-10T00:00:00.000Z')
    await updateStock({ ...group, removedAt: null })
    expect((await listStockByTank(tank.id))[0].removedAt).toBeNull()
  })

  it('keeps stock when the tank is archived, like readings', async () => {
    const { tank } = await setup()
    await archiveTank(tank.id)
    expect(await listStockByTank(tank.id)).toHaveLength(1)
  })
})

describe('stock events change the count in the same transaction', () => {
  it('applies lost, rehomed and added with the sign and records the applied delta', async () => {
    const { tank, group } = await setup(6)
    const lost = await addStockEvent(ev(tank.id, group.id, 'lost', 2))
    expect(lost.countDelta).toBe(-2)
    expect((await listStockByTank(tank.id))[0].count).toBe(4)
    await addStockEvent(ev(tank.id, group.id, 'rehomed', 1))
    expect((await listStockByTank(tank.id))[0].count).toBe(3)
    await addStockEvent(ev(tank.id, group.id, 'added', 4))
    expect((await listStockByTank(tank.id))[0].count).toBe(7)
    const events = await listStockEventsByTank(tank.id)
    expect(events.map((e) => e.countDelta ?? 0).sort((a, b) => a - b)).toEqual([-2, -1, 4])
  })

  it('stops at 0, marks the group removed, and adding more brings it back', async () => {
    const { tank, group } = await setup(3)
    const lost = await addStockEvent(ev(tank.id, group.id, 'lost', 10))
    expect(lost.countDelta).toBe(-3)
    const [empty] = await listStockByTank(tank.id)
    expect(empty.count).toBe(0)
    expect(empty.removedAt).toBe(lost.ts)
    await addStockEvent(ev(tank.id, group.id, 'added', 2))
    const [back] = await listStockByTank(tank.id)
    expect(back.count).toBe(2)
    expect(back.removedAt).toBeNull()
  })

  it('added clears removedAt on a group that was removed with animals left', async () => {
    const { tank, group } = await setup(5)
    await updateStock({ ...group, removedAt: '2026-09-10T00:00:00.000Z' })
    await addStockEvent(ev(tank.id, group.id, 'added', 2))
    const [back] = await listStockByTank(tank.id)
    expect(back.count).toBe(7)
    expect(back.removedAt).toBeNull()
  })

  it('rolls everything back when the event is invalid', async () => {
    const { tank, group } = await setup(5)
    await expect(addStockEvent(ev(tank.id, group.id, 'lost'))).rejects.toThrow(/how many/i)
    await expect(addStockEvent(ev(tank.id, group.id, 'lost', 0))).rejects.toThrow(/how many/i)
    await expect(addStockEvent(ev(tank.id, 'no-such-group', 'lost', 1))).rejects.toThrow(
      /no longer exists/,
    )
    expect((await listStockByTank(tank.id))[0].count).toBe(5)
    expect(await listStockEventsByTank(tank.id)).toEqual([])
  })

  it('stores whole-tank events and observations without touching counts', async () => {
    const { tank, group } = await setup(5)
    await addStockEvent(ev(tank.id, null, 'fed'))
    await addStockEvent({ ...ev(tank.id, group.id, 'observed'), health: 'concern', note: 'hiding' })
    expect((await listStockByTank(tank.id))[0].count).toBe(5)
    const events = await listStockEventsByTank(tank.id)
    expect(events.map((e) => e.kind).sort()).toEqual(['fed', 'observed'])
  })

  it('deletes a group with its events and leaves other groups and tank events', async () => {
    const { tank, group } = await setup(5)
    const other = await addStock({
      tankId: tank.id,
      speciesId: 'guppy',
      name: 'Guppy',
      count: 3,
      addedAt: new Date().toISOString(),
    })
    await addStockEvent(ev(tank.id, group.id, 'lost', 1))
    await addStockEvent(ev(tank.id, other.id, 'lost', 1))
    await addStockEvent(ev(tank.id, null, 'fed'))
    await deleteStock(group.id)
    expect((await listStockByTank(tank.id)).map((g) => g.id)).toEqual([other.id])
    const kinds = (await listStockEventsByTank(tank.id)).map((e) => e.stockId)
    expect(kinds.sort()).toEqual([null, other.id].sort())
  })
})

describe('tank volume', () => {
  it('saves, clears and validates litres', async () => {
    const tank = await createTank(`Stock tank ${++counter}`)
    await setTankVolume(tank.id, 60)
    expect((await listTanks()).find((t) => t.id === tank.id)?.volumeL).toBe(60)
    await setTankVolume(tank.id, null)
    expect((await listTanks()).find((t) => t.id === tank.id)?.volumeL).toBeNull()
    await expect(setTankVolume(tank.id, 0)).rejects.toThrow(/litres/)
    await expect(setTankVolume(tank.id, -5)).rejects.toThrow(/litres/)
    await expect(setTankVolume(tank.id, Number.NaN)).rejects.toThrow(/litres/)
    await expect(setTankVolume('missing', 10)).rejects.toThrow(/not found/)
  })
})

describe('backup round trip', () => {
  it('exports stock, events and volume and imports them back', async () => {
    const { tank, group } = await setup(6)
    await setTankVolume(tank.id, 75.5)
    await addStockEvent(ev(tank.id, group.id, 'lost', 1))
    await addStockEvent(ev(tank.id, null, 'fed'))
    const dump = await exportDump()
    const mine = {
      tank: dump.tanks.find((t) => t.id === tank.id),
      stock: dump.stock?.filter((g) => g.tankId === tank.id),
      events: dump.stockEvents?.filter((e) => e.tankId === tank.id),
    }
    expect(mine.tank?.volumeL).toBe(75.5)
    expect(mine.stock).toHaveLength(1)
    expect(mine.events).toHaveLength(2)

    // Through JSON, then change things locally, then import over them
    const restored = JSON.parse(JSON.stringify(dump))
    await addStockEvent(ev(tank.id, group.id, 'lost', 2))
    await setTankVolume(tank.id, 10)
    await importDump(restored)
    const [g] = await listStockByTank(tank.id)
    expect(g.count).toBe(5) // the import restores the exported count
    expect((await listTanks()).find((t) => t.id === tank.id)?.volumeL).toBe(75.5)
  })

  it('imports a backup made before stock existed and keeps existing stock', async () => {
    const { tank } = await setup(4)
    await importDump({
      tanks: [
        { id: 'old-tank', name: 'Old', createdAt: '2025-01-01T00:00:00.000Z', archivedAt: null },
      ],
      readings: [],
    })
    expect((await listTanks()).some((t) => t.id === 'old-tank')).toBe(true)
    expect(await listStockByTank(tank.id)).toHaveLength(1)
  })
})
