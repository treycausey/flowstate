import { invoke } from '@tauri-apps/api/core'
import {
  addPlant,
  addPlantCheck,
  addReading,
  createTank,
  deletePlant,
  listPlantChecksByTank,
  listPlantsByTank,
  listReadingsByTank,
  listReadingsByTankInRange,
  updatePlant,
} from '@/lib/sqlite'

jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}))

const mockInvoke = jest.mocked(invoke)

beforeEach(() => {
  mockInvoke.mockReset()
})

describe('lib/sqlite bridge payloads', () => {
  test('createTank forwards reminderCadence with camelCase key', async () => {
    mockInvoke.mockResolvedValueOnce({
      id: 't-1',
      name: 'Tank',
      createdAt: '2024-01-01T00:00:00.000Z',
      archivedAt: null,
      reminderCadence: 7,
    })

    const result = await createTank('Tank', 7)

    expect(mockInvoke).toHaveBeenCalledWith('sqlite_create_tank', {
      name: 'Tank',
      reminderCadence: 7,
    })
    expect(result.id).toBe('t-1')
  })

  test('listReadingsByTank sends tankId as camelCase', async () => {
    mockInvoke.mockResolvedValueOnce([])

    await listReadingsByTank('tank-123')

    expect(mockInvoke).toHaveBeenCalledWith('sqlite_list_readings_by_tank', {
      tankId: 'tank-123',
    })
  })

  test('listReadingsByTankInRange sends camelCase keys for params', async () => {
    mockInvoke.mockResolvedValueOnce([])

    await listReadingsByTankInRange(
      'tank-123',
      '2024-01-01T00:00:00.000Z',
      '2024-02-01T00:00:00.000Z',
    )

    expect(mockInvoke).toHaveBeenCalledWith('sqlite_list_readings_by_tank_in_range', {
      tankId: 'tank-123',
      fromIso: '2024-01-01T00:00:00.000Z',
      toIso: '2024-02-01T00:00:00.000Z',
    })
  })

  test('addReading forwards pH without renaming to snake_case', async () => {
    const reading = {
      id: 'r-1',
      tankId: 'tank-123',
      ts: '2024-01-01T00:00:00.000Z',
      pH: 7.2,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
      note: 'ok',
    }
    mockInvoke.mockResolvedValueOnce(reading)

    await addReading(reading)

    expect(mockInvoke).toHaveBeenCalledWith('sqlite_add_reading', {
      reading: expect.objectContaining({
        id: 'r-1',
        tankId: 'tank-123',
        pH: 7.2,
      }),
    })
  })

  test('plant commands use camelCase keys the Rust side expects', async () => {
    const plant = {
      tankId: 'tank-1',
      speciesId: 'java-fern',
      name: 'Java fern',
      placement: 'epiphyte' as const,
      plantedAt: '2024-01-01T00:00:00.000Z',
    }
    mockInvoke.mockResolvedValueOnce([])
    await listPlantsByTank('tank-1')
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_list_plants_by_tank', { tankId: 'tank-1' })

    mockInvoke.mockImplementationOnce(async (_cmd, args) => (args as { plant: unknown }).plant)
    const added = await addPlant(plant)
    expect(added.id).toEqual(expect.any(String))
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_add_plant', {
      plant: expect.objectContaining({ id: added.id, tankId: 'tank-1', speciesId: 'java-fern' }),
    })

    mockInvoke.mockResolvedValueOnce(undefined)
    await updatePlant({ ...added, removedAt: '2024-02-01T00:00:00.000Z' })
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_update_plant', {
      plant: expect.objectContaining({ id: added.id, removedAt: '2024-02-01T00:00:00.000Z' }),
    })

    mockInvoke.mockResolvedValueOnce(undefined)
    await deletePlant('p-1')
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_delete_plant', { id: 'p-1' })
  })

  test('plant check commands send the check with its symptoms list', async () => {
    mockInvoke.mockResolvedValueOnce([])
    await listPlantChecksByTank('tank-1')
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_list_plant_checks_by_tank', {
      tankId: 'tank-1',
    })

    mockInvoke.mockImplementationOnce(async (_cmd, args) => (args as { check: unknown }).check)
    const check = await addPlantCheck({
      plantId: 'p-1',
      tankId: 'tank-1',
      ts: '2024-01-02T00:00:00.000Z',
      health: 'struggling',
      symptoms: ['pinholes'],
      action: null,
    })
    expect(mockInvoke).toHaveBeenLastCalledWith('sqlite_add_plant_check', {
      check: expect.objectContaining({ id: check.id, plantId: 'p-1', symptoms: ['pinholes'] }),
    })
  })
})
