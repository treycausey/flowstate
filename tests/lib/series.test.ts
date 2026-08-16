import { rollingAverage, isOutOfRange, domainY } from '@/lib/series'

describe('series utils', () => {
  it('computes rolling average over window', () => {
    const points = [
      { ts: '2024-01-01T00:00:00.000Z', value: 1 },
      { ts: '2024-01-02T00:00:00.000Z', value: 3 },
      { ts: '2024-01-03T00:00:00.000Z', value: 5 },
    ]
    const avg = rollingAverage(points, 2)
    expect(avg.map((p) => p.value)).toEqual([1, 2, 4])
  })

  it('detects out-of-range correctly', () => {
    expect(isOutOfRange('pH', 6.4)).toBe(true)
    expect(isOutOfRange('pH', 6.8)).toBe(false)
    expect(isOutOfRange('ammonia', 0)).toBe(false)
    expect(isOutOfRange('ammonia', 0.25)).toBe(true)
    expect(isOutOfRange('nitrate', 25)).toBe(true)
  })

  it('computes domain with padding', () => {
    const [y0, y1] = domainY('nitrate', [0, 20])
    expect(y0).toBeLessThanOrEqual(0)
    expect(y1).toBeGreaterThanOrEqual(20)
  })
})
