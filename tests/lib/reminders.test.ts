import { isDue, nextDue, snooze24h, loadState } from '@/lib/reminders'

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
})
