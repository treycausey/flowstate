import {
  effectiveDue,
  isDue,
  loadState,
  nextDue,
  parseCadence,
  shouldNotify,
  skipOnce,
  snooze24h,
} from '@/lib/reminders'

describe('reminders', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('computes next due from last timestamp and cadence', () => {
    const now = new Date('2024-01-01T00:00:00.000Z')
    const last = new Date('2023-12-31T00:00:00.000Z').toISOString()
    const next = nextDue(last, 3, now)
    expect(next?.toISOString()).toBe('2024-01-03T00:00:00.000Z')
  })

  it('is due when cadence elapsed and not snoozed', () => {
    const now = new Date('2024-01-10T00:00:00.000Z')
    const last = new Date('2024-01-01T00:00:00.000Z').toISOString()
    expect(isDue(last, 7, 'tank1', now)).toBe(true)
    snooze24h('tank1', now)
    expect(isDue(last, 7, 'tank1', now)).toBe(false)
    const state = loadState('tank1')
    expect(state.snoozeUntil).toBe('2024-01-11T00:00:00.000Z')
  })

  it('is due immediately for a tank with no readings', () => {
    expect(isDue(null, 3, 'tank1', new Date('2024-01-01T00:00:00.000Z'))).toBe(true)
  })

  it('is never due when reminders are off', () => {
    expect(isDue('2020-01-01T00:00:00.000Z', null, 'tank1')).toBe(false)
    expect(isDue('2020-01-01T00:00:00.000Z', 0, 'tank1')).toBe(false)
  })

  it('skip hides an overdue reminder until the next cadence boundary', () => {
    // Last test Jan 1, weekly → due Jan 8; now Jan 10 (overdue)
    const last = '2024-01-01T00:00:00.000Z'
    const now = new Date('2024-01-10T00:00:00.000Z')
    skipOnce('tank1', 7, last, now)
    expect(isDue(last, 7, 'tank1', now)).toBe(false)
    expect(isDue(last, 7, 'tank1', new Date('2024-01-14T23:00:00.000Z'))).toBe(false)
    expect(isDue(last, 7, 'tank1', new Date('2024-01-15T00:00:00.000Z'))).toBe(true)
    expect(effectiveDue(last, 7, 'tank1', now)?.toISOString()).toBe('2024-01-15T00:00:00.000Z')
  })

  it('skip with no readings defers by one cadence', () => {
    const now = new Date('2024-01-10T00:00:00.000Z')
    skipOnce('tank1', 3, null, now)
    expect(isDue(null, 3, 'tank1', now)).toBe(false)
    expect(isDue(null, 3, 'tank1', new Date('2024-01-13T00:00:00.000Z'))).toBe(true)
  })

  it('a new reading supersedes an older snooze', () => {
    const now = new Date('2024-01-10T00:00:00.000Z')
    snooze24h('tank1', now)
    // Logged a reading now; next due is a week out, beyond the snooze
    expect(effectiveDue(now.toISOString(), 7, 'tank1', now)?.toISOString()).toBe(
      '2024-01-17T00:00:00.000Z',
    )
  })

  it('notifies once per due date', () => {
    const due = new Date('2024-01-08T00:00:00.000Z')
    expect(shouldNotify('tank1', due)).toBe(true)
    expect(shouldNotify('tank1', due)).toBe(false)
    expect(shouldNotify('tank1', new Date('2024-01-15T00:00:00.000Z'))).toBe(true)
  })

  it('parses custom cadence as whole days 1–365', () => {
    expect(parseCadence('5')).toBe(5)
    expect(parseCadence('0')).toBeNull()
    expect(parseCadence('-2')).toBeNull()
    expect(parseCadence('2.5')).toBeNull()
    expect(parseCadence('')).toBeNull()
    expect(parseCadence('400')).toBeNull()
  })
})
