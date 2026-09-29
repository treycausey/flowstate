import {
  calendarDaysBetween,
  formatLocal,
  fromDatetimeLocalValue,
  offsetStringFromMinutes,
  toDatetimeLocalValue,
  toISOWithOffset,
  toStorageTs,
} from '@/lib/time'

describe('time helpers', () => {
  it('formats offset from minutes sign-correctly', () => {
    expect(offsetStringFromMinutes(0)).toBe('+00:00')
    expect(offsetStringFromMinutes(-480)).toBe('+08:00')
    expect(offsetStringFromMinutes(330)).toBe('-05:30')
  })

  it('produces ISO with local offset', () => {
    const d = new Date('2024-03-10T01:30:00.000Z')
    const iso = toISOWithOffset(new Date(d))
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/)
  })

  it('normalizes storage timestamps to UTC', () => {
    expect(toStorageTs('2024-01-01T08:00:00.000-08:00')).toBe('2024-01-01T16:00:00.000Z')
    expect(toStorageTs(new Date('2024-01-01T00:00:00Z'))).toBe('2024-01-01T00:00:00.000Z')
    expect(() => toStorageTs('not a date')).toThrow(RangeError)
  })

  it('round-trips datetime-local values in local time', () => {
    const d = new Date(2024, 4, 6, 9, 5)
    const v = toDatetimeLocalValue(d)
    expect(v).toBe('2024-05-06T09:05')
    expect(fromDatetimeLocalValue(v)?.getTime()).toBe(d.getTime())
    expect(fromDatetimeLocalValue('')).toBeNull()
    expect(fromDatetimeLocalValue('garbage')).toBeNull()
  })

  it('formats local display string', () => {
    const s = formatLocal(new Date('2024-01-01T00:00:00.000Z'), 'en-US', { year: 'numeric' })
    expect(s).toMatch(/\d{4}/)
  })
})

describe('calendarDaysBetween', () => {
  it('counts local calendar days, not 24-hour periods', () => {
    expect(calendarDaysBetween(new Date(2026, 0, 9, 23), new Date(2026, 0, 10, 9))).toBe(1)
    expect(calendarDaysBetween(new Date(2026, 0, 9, 0, 1), new Date(2026, 0, 9, 23, 59))).toBe(0)
    expect(calendarDaysBetween(new Date(2026, 0, 1, 12), new Date(2026, 0, 4, 1))).toBe(3)
  })
  it('never goes negative', () => {
    expect(calendarDaysBetween(new Date(2026, 0, 11), new Date(2026, 0, 10))).toBe(0)
  })
})
