import { getEnvironment, holidayAt, moonAt, phaseAt, seasonAt } from '@/lib/tank/environment'

const at = (h: number, m = 0, date: [number, number, number] = [2026, 5, 15]) =>
  new Date(date[0], date[1], date[2], h, m)

describe('phases', () => {
  it.each([
    [5, 29, 'night'],
    [5, 30, 'dawn'],
    [7, 59, 'dawn'],
    [8, 0, 'day'],
    [17, 59, 'day'],
    [18, 0, 'dusk'],
    [20, 29, 'dusk'],
    [20, 30, 'night'],
    [0, 0, 'night'],
  ])('%i:%i is %s', (h, m, phase) => {
    expect(getEnvironment(at(h, m)).phase).toBe(phase)
  })

  it('reports progress through the phase, including across midnight', () => {
    expect(phaseAt(6.75).progress).toBeCloseTo(0.5, 5)
    expect(phaseAt(20.5).progress).toBeCloseTo(0, 5)
    expect(phaseAt(1).progress).toBeCloseTo(4.5 / 9, 5)
    expect(phaseAt(5.4).progress).toBeLessThan(1)
  })

  it('has more light at noon than at midnight, and a unit-length sun direction', () => {
    const noon = getEnvironment(at(13))
    const midnight = getEnvironment(at(0))
    expect(noon.light.intensity).toBeGreaterThan(0.9)
    expect(midnight.light.intensity).toBeLessThan(0.3)
    expect(midnight.light.colorTemp).toBeGreaterThan(noon.light.colorTemp)
    const [x, y] = noon.light.sunDir
    expect(Math.hypot(x, y)).toBeCloseTo(1, 5)
  })
})

describe('seasons', () => {
  it('follows the northern calendar by default', () => {
    expect(seasonAt(new Date(2026, 0, 10))).toBe('winter')
    expect(seasonAt(new Date(2026, 3, 10))).toBe('spring')
    expect(seasonAt(new Date(2026, 6, 10))).toBe('summer')
    expect(seasonAt(new Date(2026, 9, 10))).toBe('autumn')
    expect(seasonAt(new Date(2026, 11, 10))).toBe('winter')
  })

  it('flips in the southern hemisphere', () => {
    expect(seasonAt(new Date(2026, 0, 10), 'south')).toBe('summer')
    expect(seasonAt(new Date(2026, 3, 10), 'south')).toBe('autumn')
    expect(seasonAt(new Date(2026, 6, 10), 'south')).toBe('winter')
    expect(seasonAt(new Date(2026, 9, 10), 'south')).toBe('spring')
    expect(getEnvironment(new Date(2026, 6, 10), { hemisphere: 'south' }).season).toBe('winter')
  })
})

describe('moon', () => {
  it.each([['2024-01-25T17:54:00Z'], ['2025-03-14T06:55:00Z'], ['2026-01-03T10:03:00Z']])(
    'is full near the known full moon %s',
    (iso) => {
      const moon = moonAt(new Date(iso))
      expect(moon.illumination).toBeGreaterThan(0.97)
      expect(Math.abs(moon.phase - 0.5)).toBeLessThan(0.03)
    },
  )

  it('is new near a known new moon', () => {
    expect(moonAt(new Date('2025-01-29T12:36:00Z')).illumination).toBeLessThan(0.03)
  })
})

describe('holidays', () => {
  it('finds each holiday and nothing on ordinary days', () => {
    expect(holidayAt(new Date(2026, 9, 31, 12))).toBe('halloween')
    expect(holidayAt(new Date(2026, 9, 30, 12))).toBeNull()
    expect(holidayAt(new Date(2026, 11, 24, 8))).toBe('winter')
    expect(holidayAt(new Date(2026, 11, 26, 23))).toBe('winter')
    expect(holidayAt(new Date(2026, 11, 27, 8))).toBeNull()
    expect(holidayAt(new Date(2026, 11, 31, 21, 59))).toBeNull()
    expect(holidayAt(new Date(2026, 11, 31, 22, 0))).toBe('newyear')
    expect(holidayAt(new Date(2027, 0, 1, 1, 59))).toBe('newyear')
    expect(holidayAt(new Date(2027, 0, 1, 2, 0))).toBeNull()
  })
})
