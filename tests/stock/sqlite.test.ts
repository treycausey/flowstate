import { invoke } from '@tauri-apps/api/core'
import {
  addStock,
  addStockEvent,
  deleteStock,
  listStockByTank,
  listStockEventsByTank,
  setTankVolume,
  updateStock,
} from '@/lib/sqlite'

jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}))

const mockInvoke = jest.mocked(invoke)

beforeEach(() => {
  mockInvoke.mockReset()
})

describe('lib/sqlite stock bridge payloads', () => {
  test('setTankVolume sends volumeL, null to clear', async () => {
    mockInvoke.mockResolvedValue(undefined)
    await setTankVolume('t-1', 60)
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_set_tank_volume', {
      id: 't-1',
      volumeL: 60,
    })
    await setTankVolume('t-1', null)
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_set_tank_volume', {
      id: 't-1',
      volumeL: null,
    })
  })

  test('group commands send camelCase keys', async () => {
    mockInvoke.mockResolvedValueOnce([])
    await listStockByTank('tank-1')
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_list_stock_by_tank', { tankId: 'tank-1' })

    mockInvoke.mockImplementationOnce(async (_cmd, args) => (args as { group: unknown }).group)
    const added = await addStock({
      tankId: 'tank-1',
      speciesId: 'neon-tetra',
      name: 'Neon tetra',
      count: 6,
      addedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_add_stock', {
      group: expect.objectContaining({ id: added.id, tankId: 'tank-1', count: 6 }),
    })

    mockInvoke.mockResolvedValueOnce(undefined)
    await updateStock({ ...added, removedAt: '2026-02-01T00:00:00.000Z' })
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_update_stock', {
      group: expect.objectContaining({ id: added.id, removedAt: '2026-02-01T00:00:00.000Z' }),
    })

    mockInvoke.mockResolvedValueOnce(undefined)
    await deleteStock('g-1')
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_delete_stock', { id: 'g-1' })
  })

  test('event commands send the event and return what the store applied', async () => {
    mockInvoke.mockResolvedValueOnce([])
    await listStockEventsByTank('tank-1')
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_list_stock_events_by_tank', {
      tankId: 'tank-1',
    })

    mockInvoke.mockImplementationOnce(async (_cmd, args) => ({
      ...(args as { event: object }).event,
      countDelta: -3,
    }))
    const saved = await addStockEvent({
      tankId: 'tank-1',
      stockId: 'g-1',
      ts: '2026-01-02T00:00:00.000Z',
      kind: 'lost',
      countDelta: 5,
    })
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_add_stock_event', {
      event: expect.objectContaining({ stockId: 'g-1', kind: 'lost', countDelta: 5 }),
    })
    expect(saved.countDelta).toBe(-3)
  })
})
