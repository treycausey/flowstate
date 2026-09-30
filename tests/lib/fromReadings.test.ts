import type { Reading } from '@/lib/models'
import { waterFromReadings } from '@/lib/tank/fromReadings'
import { NEUTRAL_WATER } from '@/lib/tank/waterState'

const NOW = new Date(2026, 8, 29, 12, 0, 0)
const DAY = 86_400_000
let n = 0
function reading(daysAgo: number, v: Partial<Reading> = {}): Reading {
  return {
    id: `r${n++}`,
    tankId: 't',
    ts: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    pH: 7,
    ammonia: 0,
    nitrite: 0,
    nitrate: 10,
    ...v,
  }
}
/** One in-range reading per day, newest `daysAgo` days back. */
const run = (count: number, newest = 0) =>
  Array.from({ length: count }, (_, i) => reading(newest + count - 1 - i))

describe('waterFromReadings', () => {
  it('returns neutral water for an empty tank', () => {
    expect(waterFromReadings([], NOW)).toBe(NEUTRAL_WATER)
  })

  it('shows a healthy cycled tank as thriving and clean', () => {
    const w = waterFromReadings(run(4), NOW)
    expect(w.mood).toBe('thriving')
    expect(w.haze).toBe(0)
    expect(w.algae).toBe(0)
    expect(w.dust).toBe(0)
    expect(w.bubbleNest).toBe(false)
  })

  it('stresses the fish and hazes the water when ammonia is above 0', () => {
    const w = waterFromReadings([...run(3, 1), reading(0, { ammonia: 0.5 })], NOW)
    expect(w.mood).toBe('stressed')
    expect(w.haze).toBeGreaterThan(0.5)
  })

  it('tints the water with algae when nitrate is 80', () => {
    const w = waterFromReadings([...run(3, 1), reading(0, { nitrate: 80 })], NOW)
    expect(w.algae).toBe(1)
    expect(w.mood).toBe('dull')
  })

  it('dusts the glass after 10 days without a test', () => {
    const w = waterFromReadings(run(4, 10), NOW)
    expect(w.dust).toBeGreaterThan(0)
  })

  it('builds a bubble nest after an 8-day good streak', () => {
    expect(waterFromReadings(run(8), NOW).bubbleNest).toBe(true)
    expect(waterFromReadings(run(5), NOW).bubbleNest).toBe(false)
  })
})
