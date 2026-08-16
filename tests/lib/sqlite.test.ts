import { invoke } from '@tauri-apps/api/tauri'
import { createTank, listReadingsByTank, listReadingsByTankInRange, addReading } from '@/lib/sqlite'

jest.mock('@tauri-apps/api/tauri', () => ({
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
})
