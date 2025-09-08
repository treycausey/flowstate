import { filterReadingsByDays, summarizeOutOfRange } from '@/lib/report'

const mk = (ts: string, pH: number, ammonia = 0, nitrite = 0, nitrate = 10) => ({
  id: ts,
  tankId: 't1',
  ts,
  pH,
  ammonia,
  nitrite,
  nitrate,
})

describe('report utils', () => {
  it('filters by days', () => {
    const now = new Date('2024-01-31T00:00:00.000Z')
    const r = [
      mk('2024-01-15T00:00:00.000Z', 7.0),
      mk('2023-12-25T00:00:00.000Z', 7.0),
    ]
    const last30 = filterReadingsByDays(r as any, 30, now)
    expect(last30.length).toBe(1)
  })

  it('summarizes out-of-range counts', () => {
    const r = [
      mk('2024-01-01T00:00:00.000Z', 6.4), // pH low
      mk('2024-01-02T00:00:00.000Z', 7.0, 0.25), // ammonia high
      mk('2024-01-03T00:00:00.000Z', 7.0, 0, 0.1), // nitrite high
      mk('2024-01-04T00:00:00.000Z', 7.0, 0, 0, 50), // nitrate high
    ]
    const s = summarizeOutOfRange(r as any)
    expect(s).toEqual({ pH: 1, ammonia: 1, nitrite: 1, nitrate: 1 })
  })
})

