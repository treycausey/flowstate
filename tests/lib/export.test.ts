import { readingsToCsv } from '@/lib/export'

const tank = { id: 't1', name: 'Main Tank', createdAt: '', archivedAt: null, reminderCadence: null }

const readings = [
  { id: 'r1', tankId: 't1', ts: '2024-01-01T00:00:00.000Z', pH: 7.1, ammonia: 0, nitrite: 0, nitrate: 10 },
]

describe('export csv', () => {
  it('produces header and a row', () => {
    const csv = readingsToCsv(tank as any, readings as any)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note')
    expect(lines[1]).toContain('t1,Main Tank,2024-01-01T00:00:00.000Z,7.1,0,0,10')
  })
})

