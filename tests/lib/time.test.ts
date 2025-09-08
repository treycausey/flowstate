import { offsetStringFromMinutes, toISOWithOffset, formatLocal } from '@/lib/time'

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

  it('formats local display string', () => {
    const s = formatLocal(new Date('2024-01-01T00:00:00.000Z'), 'en-US', { year: 'numeric' })
    expect(s).toMatch(/\d{4}/)
  })
})

