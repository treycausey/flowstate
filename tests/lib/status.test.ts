import type { Reading } from '@/lib/models'
import { cycleStatus, daysSinceLastTest, metricStatus, tankStatus } from '@/lib/status'

let n = 0
const day = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString()
function reading(d: number, values: Partial<Reading> = {}): Reading {
  return {
    id: `r${++n}`,
    tankId: 't',
    ts: day(d),
    pH: null,
    ammonia: null,
    nitrite: null,
    nitrate: null,
    ...values,
  }
}

describe('metricStatus', () => {
  it('uses the latest tested value and skips untested readings', () => {
    const rs = [
      reading(1, { ammonia: 0.5 }),
      reading(2, { ammonia: 1 }),
      reading(3, { nitrite: 0.25 }), // did not test ammonia
    ]
    const s = metricStatus(rs, 'ammonia')
    expect(s.latest).toEqual({ value: 1, ts: day(2) })
    expect(s.previous).toEqual({ value: 0.5, ts: day(1) })
    expect(s.trend).toBe('up')
    expect(metricStatus(rs, 'nitrite')).toMatchObject({ trend: null, previous: null })
    expect(metricStatus(rs, 'pH')).toEqual({ latest: null, previous: null, trend: null })
  })

  it('reports down and flat, regardless of input order', () => {
    const rs = [
      reading(3, { nitrate: 10 }),
      reading(1, { nitrate: 20 }),
      reading(2, { nitrate: 10 }),
    ]
    expect(metricStatus(rs, 'nitrate').trend).toBe('flat')
    expect(metricStatus([reading(1, { pH: 7.4 }), reading(2, { pH: 7.0 })], 'pH').trend).toBe(
      'down',
    )
  })
})

describe('daysSinceLastTest', () => {
  // Local-time timestamps, so the tests do not depend on the machine's time zone
  const local = (d: number, h = 12): Reading => ({
    ...reading(1, { pH: 7 }),
    ts: new Date(2026, 0, d, h).toISOString(),
  })
  const now = new Date(2026, 0, 10, 12)
  it('counts calendar days from the newest reading of any kind', () => {
    expect(daysSinceLastTest([local(1), local(8)], now)).toBe(2)
  })
  it('is 0 on the same day and null when empty', () => {
    expect(daysSinceLastTest([local(10)], now)).toBe(0)
    expect(daysSinceLastTest([], now)).toBeNull()
  })
  it('counts yesterday evening as 1 day even when under 24 hours ago', () => {
    expect(daysSinceLastTest([local(9, 23)], new Date(2026, 0, 10, 9))).toBe(1)
  })
  it('never goes negative for a reading slightly in the future', () => {
    expect(daysSinceLastTest([local(11)], now)).toBe(0)
  })
})

describe('cycleStatus', () => {
  const zero = (d: number, extra: Partial<Reading> = {}) =>
    reading(d, { ammonia: 0, nitrite: 0, ...extra })

  it('not-started with no ammonia/nitrite results', () => {
    expect(cycleStatus([])).toBe('not-started')
    expect(cycleStatus([reading(1, { pH: 7, nitrate: 10 })])).toBe('not-started')
  })

  it('cycling when the latest ammonia or nitrite is above 0', () => {
    expect(cycleStatus([reading(1, { ammonia: 0.5, nitrite: 0 })])).toBe('cycling')
    expect(cycleStatus([reading(1, { ammonia: 0, nitrite: 0.25 })])).toBe('cycling')
    // Latest tested value wins over older ones, per metric.
    expect(cycleStatus([reading(1, { ammonia: 2 }), reading(2, { nitrite: 0 })])).toBe('cycling')
    expect(cycleStatus([reading(1, { ammonia: 2, nitrite: 0 }), reading(2, { ammonia: 0 })])).toBe(
      'nearly-cycled',
    )
  })

  it('nearly-cycled with fewer than 3 zero-zero tests', () => {
    const rs = [
      reading(1, { ammonia: 1, nitrite: 1 }),
      zero(2, { nitrate: 5 }),
      zero(3, { nitrate: 5 }),
    ]
    expect(cycleStatus(rs)).toBe('nearly-cycled')
  })

  it('nearly-cycled when nitrate was never above 0', () => {
    expect(cycleStatus([zero(1), zero(2), zero(3, { nitrate: 0 })])).toBe('nearly-cycled')
  })

  it('cycled after 3 zero-zero tests and nitrate seen', () => {
    const rs = [reading(1, { ammonia: 1, nitrite: 1 }), zero(2, { nitrate: 5 }), zero(3), zero(4)]
    expect(cycleStatus(rs)).toBe('cycled')
  })

  it('skips partial readings when counting the streak', () => {
    const rs = [
      zero(1, { nitrate: 5 }),
      reading(2, { ammonia: 0 }), // nitrite untested: not part of the pair streak
      zero(3),
      reading(4, { pH: 7 }),
      zero(5),
    ]
    expect(cycleStatus(rs)).toBe('cycled')
  })

  it('a positive reading in the last 3 paired tests breaks the streak', () => {
    const rs = [
      zero(1, { nitrate: 5 }),
      zero(2),
      reading(3, { ammonia: 0.25, nitrite: 0 }),
      zero(4),
    ]
    expect(cycleStatus(rs)).toBe('nearly-cycled')
  })

  it('a newer ammonia-only spike returns to cycling', () => {
    const rs = [zero(1, { nitrate: 5 }), zero(2), zero(3), reading(4, { ammonia: 0.5 })]
    expect(cycleStatus(rs)).toBe('cycling')
  })

  it('is not-started when ammonia or nitrite was never tested, unless the tested one is above 0', () => {
    expect(cycleStatus([reading(1, { ammonia: 0 })])).toBe('not-started')
    expect(cycleStatus([reading(1, { nitrite: 0 })])).toBe('not-started')
    expect(cycleStatus([reading(1, { ammonia: 0, nitrate: 20 })])).toBe('not-started')
    expect(cycleStatus([reading(1, { ammonia: 0.5 })])).toBe('cycling')
    expect(cycleStatus([reading(1, { nitrite: 0.25 })])).toBe('cycling')
  })
})

describe('tankStatus', () => {
  it('combines the pieces', () => {
    const now = new Date(Date.UTC(2026, 0, 4, 1))
    const s = tankStatus(
      [reading(1, { ammonia: 0.5 }), reading(3, { ammonia: 0.25, nitrite: 0 })],
      now,
    )
    expect(s.cycle).toBe('cycling')
    expect(s.daysSinceLastTest).toBe(1)
    expect(s.metrics.ammonia.trend).toBe('down')
    expect(s.metrics.nitrate.latest).toBeNull()
  })
})
