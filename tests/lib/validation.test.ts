import { normalizeInput, parseMetricInput, stepMetricText } from '@/lib/validation'

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

  it('accepts only plain decimals', () => {
    for (const raw of ['0x10', '1e1', '+7', 'Infinity', '7,1,2', '7.1.2', '1 0', '.', '--1'])
      expect(parseMetricInput('nitrate', raw)).toEqual({ ok: false, error: 'Enter a number' })
    expect(parseMetricInput('nitrate', '.5')).toEqual({ ok: true, value: 0.5 })
    expect(parseMetricInput('nitrate', '5.')).toEqual({ ok: true, value: 5 })
  })

  it('accepts valid values, including decimal commas', () => {
    expect(parseMetricInput('pH', '7.6')).toEqual({ ok: true, value: 7.6 })
    expect(parseMetricInput('nitrite', '0,25')).toEqual({ ok: true, value: 0.25 })
    expect(parseMetricInput('ammonia', '0')).toEqual({ ok: true, value: 0 })
  })
})

describe('validation/stepMetricText', () => {
  it('steps plain decimals and starts blank from the minimum', () => {
    expect(stepMetricText('pH', '7.0', 1)).toBe('7.1')
    expect(stepMetricText('pH', '7,0', -1)).toBe('6.9')
    expect(stepMetricText('ammonia', '', 1)).toBe('0')
  })

  it('leaves non-plain-decimal text unchanged', () => {
    for (const raw of ['0x10', '1e1', '+7', 'Infinity', 'o.5', '7.1.2']) {
      expect(stepMetricText('pH', raw, 1)).toBe(raw)
    }
  })
})
