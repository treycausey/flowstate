import { domainY, isOutOfRange, readingsToSeries, rollingAverage, severity } from '@/lib/series'

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

  it('grades nitrate caution vs high', () => {
    expect(severity('nitrate', 10)).toBe('ok')
    expect(severity('nitrate', 30)).toBe('caution')
    expect(severity('nitrate', 40)).toBe('caution')
    expect(severity('nitrate', 41)).toBe('high')
    expect(severity('ammonia', 0.25)).toBe('high')
  })

  it('computes domain with padding', () => {
    const [y0, y1] = domainY('nitrate', [0, 20])
    expect(y0).toBeLessThanOrEqual(0)
    expect(y1).toBeGreaterThanOrEqual(20)
  })

  it('never produces a negative ppm axis', () => {
    expect(domainY('ammonia', [0, 0, 0])[0]).toBe(0)
    expect(domainY('nitrite', [0.25])[0]).toBe(0)
    expect(domainY('ammonia', [0])[1]).toBeGreaterThan(0)
    expect(domainY('ammonia', [2])[1]).toBeGreaterThanOrEqual(2)
  })

  it('keeps the pH optimal band visible', () => {
    const [y0, y1] = domainY('pH', [7.0, 7.1])
    expect(y0).toBeLessThanOrEqual(6.5)
    expect(y1).toBeGreaterThanOrEqual(7.5)
  })

  it('handles empty input', () => {
    expect(domainY('nitrate', [])).toEqual([0, 20])
    expect(domainY('pH', []).every(Number.isFinite)).toBe(true)
  })

  it('splits readings into per-metric series with notes', () => {
    const s = readingsToSeries([
      {
        id: 'a',
        tankId: 't',
        ts: '2024-01-01T00:00:00.000Z',
        pH: 7,
        ammonia: 0,
        nitrite: 0,
        nitrate: 5,
        note: 'wc',
      },
    ])
    expect(s.nitrate).toEqual([{ ts: '2024-01-01T00:00:00.000Z', value: 5, note: 'wc' }])
    expect(s.pH[0].value).toBe(7)
  })
})
