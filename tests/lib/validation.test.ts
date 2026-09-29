import { normalizeInput, parseMetricInput } from '@/lib/validation'

describe('validation/normalizeInput', () => {
  it('keeps typed kit values and clamps ranges', () => {
    expect(normalizeInput('pH', 7.14)).toBe(7.14)
    expect(normalizeInput('pH', 7.141)).toBe(7.14)
    // Real API kit colors that don't fall on the stepper grid survive
    expect(normalizeInput('nitrite', 0.25)).toBe(0.25)
    expect(normalizeInput('ammonia', 0.5)).toBe(0.5)
    expect(normalizeInput('nitrate', 21.44)).toBe(21.4)
    expect(normalizeInput('pH', 10)).toBe(9)
    expect(normalizeInput('pH', 4)).toBe(5)
  })
})

describe('validation/parseMetricInput', () => {
  it('rejects blanks instead of treating them as zero', () => {
    expect(parseMetricInput('pH', '')).toEqual({ ok: false, error: 'Required' })
    expect(parseMetricInput('ammonia', '   ')).toEqual({ ok: false, error: 'Required' })
  })

  it('rejects non-numbers and out-of-range values', () => {
    expect(parseMetricInput('nitrate', 'abc').ok).toBe(false)
    expect(parseMetricInput('pH', '14')).toEqual({ ok: false, error: 'Must be 5–9' })
    expect(parseMetricInput('ammonia', '-1').ok).toBe(false)
  })

  it('accepts valid values, including decimal commas', () => {
    expect(parseMetricInput('pH', '7.6')).toEqual({ ok: true, value: 7.6 })
    expect(parseMetricInput('nitrite', '0,25')).toEqual({ ok: true, value: 0.25 })
    expect(parseMetricInput('ammonia', '0')).toEqual({ ok: true, value: 0 })
  })
})
