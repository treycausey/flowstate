import { fieldHint } from '@/lib/hints'

describe('fieldHint', () => {
  it('warns that any ammonia or nitrite above 0 is toxic', () => {
    expect(fieldHint('ammonia', '0.5')).toEqual({ tone: 'danger', text: 'Above 0 — toxic to fish' })
    expect(fieldHint('nitrite', '0,25')?.tone).toBe('danger')
    expect(fieldHint('ammonia', '0')).toBeNull()
    expect(fieldHint('nitrite', '0')).toBeNull()
  })

  it('separates nitrate caution (over 20 to 40) from high (over 40)', () => {
    expect(fieldHint('nitrate', '10')).toBeNull()
    expect(fieldHint('nitrate', '20')).toBeNull()
    expect(fieldHint('nitrate', '30')).toEqual({ tone: 'caution', text: 'Caution — 20 to 40 ppm' })
    expect(fieldHint('nitrate', '40')?.text).toBe('Caution — 20 to 40 ppm')
    expect(fieldHint('nitrate', '80')).toEqual({ tone: 'caution', text: 'High — above 40 ppm' })
  })

  it('stays quiet for blank, unparseable, and unrelated fields', () => {
    expect(fieldHint('ammonia', '')).toBeNull()
    expect(fieldHint('ammonia', ' ')).toBeNull()
    expect(fieldHint('nitrate', 'abc')).toBeNull()
    expect(fieldHint('pH', '9')).toBeNull()
  })
})
