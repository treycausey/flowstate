import { readingsToCsv, safeFilePart } from '@/lib/export'
import type { Reading, Tank } from '@/lib/models'

const tank: Tank = {
  id: 't1',
  name: 'Main Tank',
  createdAt: '',
  archivedAt: null,
  reminderCadence: null,
}

const base: Reading = {
  id: 'r1',
  tankId: 't1',
  ts: '2024-01-01T00:00:00.000Z',
  pH: 7.1,
  ammonia: 0,
  nitrite: 0,
  nitrate: 10,
}

describe('export csv', () => {
  it('produces header and a row', () => {
    const csv = readingsToCsv(tank, [base])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note')
    expect(lines[1]).toBe('t1,Main Tank,2024-01-01T00:00:00.000Z,7.1,0,0,10,')
  })

  it('quotes commas, quotes, and line breaks', () => {
    const csv = readingsToCsv({ ...tank, name: 'Tank, "big"' }, [
      { ...base, note: 'line1\r\nline2' },
    ])
    expect(csv).toContain('"Tank, ""big"""')
    expect(csv).toContain('"line1\r\nline2"')
  })

  it('makes safe file names', () => {
    expect(safeFilePart('My Tank / 29 gal')).toBe('My-Tank-29-gal')
    expect(safeFilePart('  ')).toBe('tank')
    expect(safeFilePart('Café')).toBe('Café')
  })
})
