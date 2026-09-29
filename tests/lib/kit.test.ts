import { KIT_PH_HIGH_RANGE, KIT_VALUES, formatKitValue, isKitValueSelected } from '@/lib/kit'
import { METRICS } from '@/lib/models'
import { parseMetricInput } from '@/lib/validation'

describe('kit values', () => {
  it('every chip value passes validation unchanged', () => {
    for (const m of METRICS) {
      const values = m === 'pH' ? [...KIT_VALUES.pH, ...KIT_PH_HIGH_RANGE] : KIT_VALUES[m]
      for (const v of values) {
        expect(parseMetricInput(m, String(v))).toEqual({ ok: true, value: v })
      }
    }
  })

  it('formats and matches values', () => {
    expect(formatKitValue('pH', 7)).toBe('7.0')
    expect(formatKitValue('ammonia', 0.25)).toBe('0.25')
    expect(isKitValueSelected('7', 7)).toBe(true)
    expect(isKitValueSelected('7.0', 7)).toBe(true)
    expect(isKitValueSelected('', 0)).toBe(false)
    expect(isKitValueSelected(' 0,25 ', 0.25)).toBe(true)
  })
})
