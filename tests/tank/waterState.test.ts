import type { Reading } from '@/lib/models'
import {
  algaeForNitrate,
  deriveWaterState,
  dustForDays,
  goodStreakDays,
  type WaterInput,
} from '@/lib/tank/waterState'

const base: WaterInput = {
  cycle: 'cycled',
  latest: { pH: 7, ammonia: 0, nitrite: 0, nitrate: 10 },
  daysSinceLastTest: 0,
  goodStreakDays: 0,
}
const withLatest = (
  latest: Partial<WaterInput['latest']>,
  rest: Partial<WaterInput> = {},
): WaterInput => ({
  ...base,
  ...rest,
  latest: { ...base.latest, ...latest },
})

describe('deriveWaterState', () => {
  it('is thriving and sparkling when cycled with low nitrate', () => {
    const s = deriveWaterState(base)
    expect(s).toMatchObject({
      mood: 'thriving',
      sparkle: 1,
      haze: 0,
      algae: 0,
      dust: 0,
      bubbleNest: false,
    })
  })

  it('stresses the fish and hazes the water when ammonia or nitrite is above zero', () => {
    expect(deriveWaterState(withLatest({ ammonia: 0.5 }))).toMatchObject({
      mood: 'stressed',
      haze: 0.55,
    })
    expect(deriveWaterState(withLatest({ nitrite: 0.25 })).haze).toBeCloseTo(0.45, 5)
    expect(deriveWaterState(withLatest({ ammonia: 8 })).haze).toBe(1)
    expect(
      deriveWaterState(withLatest({ ammonia: 0.25 }, { cycle: 'cycling' })).sparkle,
    ).toBeLessThan(0.3)
  })

  it('grows algae smoothly with nitrate', () => {
    expect(algaeForNitrate(null)).toBe(0)
    expect(algaeForNitrate(20)).toBe(0)
    expect(algaeForNitrate(30)).toBeGreaterThan(0.15)
    expect(algaeForNitrate(30)).toBeLessThan(0.4)
    expect(algaeForNitrate(40)).toBeCloseTo(0.4, 5)
    expect(algaeForNitrate(80)).toBe(1)
    expect(algaeForNitrate(160)).toBe(1)
    const a = algaeForNitrate(55)
    expect(a).toBeGreaterThan(0.4)
    expect(a).toBeLessThan(1)
  })

  it('turns dull when algae is heavy', () => {
    expect(deriveWaterState(withLatest({ nitrate: 60 })).mood).toBe('dull')
    expect(deriveWaterState(withLatest({ nitrate: 30 })).mood).toBe('healthy')
  })

  it('is healthy, not thriving, before the tank has cycled', () => {
    expect(deriveWaterState({ ...base, cycle: 'nearly-cycled' })).toMatchObject({ mood: 'healthy' })
  })

  it('ramps dust after a week without tests, to full at 30 days', () => {
    expect(dustForDays(null)).toBe(0)
    expect(dustForDays(7)).toBe(0)
    expect(dustForDays(18.5)).toBeCloseTo(0.5, 5)
    expect(dustForDays(30)).toBe(1)
    expect(dustForDays(90)).toBe(1)
  })

  it('builds a bubble nest after a seven day good streak', () => {
    expect(deriveWaterState({ ...base, goodStreakDays: 6 }).bubbleNest).toBe(false)
    expect(deriveWaterState({ ...base, goodStreakDays: 7 }).bubbleNest).toBe(true)
  })
})

let n = 0
const reading = (day: number, v: Partial<Reading>): Reading => ({
  id: `r${++n}`,
  tankId: 't',
  ts: new Date(2026, 0, day, 12).toISOString(),
  pH: 7,
  ammonia: 0,
  nitrite: 0,
  nitrate: 10,
  ...v,
})

describe('goodStreakDays', () => {
  it('is 0 without readings or when the latest is out of range', () => {
    expect(goodStreakDays([])).toBe(0)
    expect(goodStreakDays([reading(1, {}), reading(2, { ammonia: 0.25 })])).toBe(0)
  })

  it('counts one good reading as one day', () => {
    expect(goodStreakDays([reading(5, {})])).toBe(1)
  })

  it('counts calendar days across the unbroken run, ending at the latest reading', () => {
    const rs = [reading(1, { nitrite: 1 }), reading(3, {}), reading(6, {}), reading(9, {})]
    expect(goodStreakDays(rs)).toBe(7)
  })

  it('ignores untested metrics and judges nitrate and pH', () => {
    expect(
      goodStreakDays([reading(1, { pH: null, ammonia: null, nitrite: null, nitrate: null })]),
    ).toBe(1)
    expect(goodStreakDays([reading(1, {}), reading(2, { nitrate: 40 })])).toBe(0)
    expect(goodStreakDays([reading(1, {}), reading(2, { pH: 8 })])).toBe(0)
    expect(goodStreakDays([reading(1, {}), reading(2, { pH: 6.4 })])).toBe(0)
  })
})
