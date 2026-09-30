import { isNewYearWindow, noteSummonsBetta, shouldShimmer } from '@/lib/tank/eggs'
import { devClockFromSearch } from '@/lib/tank/devOverrides'

describe('noteSummonsBetta', () => {
  it('fires when typing completes the word, case-insensitively, and only once', () => {
    expect(noteSummonsBetta('bett', 'betta')).toBe(true)
    expect(noteSummonsBetta('my BETT', 'my BETTA')).toBe(true)
    expect(noteSummonsBetta('betta', 'betta!')).toBe(false)
    expect(noteSummonsBetta('', 'water change')).toBe(false)
  })
})

describe('isNewYearWindow', () => {
  it('covers Dec 31 23:59 through Jan 1 00:10 local time', () => {
    expect(isNewYearWindow(new Date(2026, 11, 31, 23, 58, 59))).toBe(false)
    expect(isNewYearWindow(new Date(2026, 11, 31, 23, 59, 0))).toBe(true)
    expect(isNewYearWindow(new Date(2027, 0, 1, 0, 10, 0))).toBe(true)
    expect(isNewYearWindow(new Date(2027, 0, 1, 0, 11, 0))).toBe(false)
    expect(isNewYearWindow(new Date(2026, 5, 1, 0, 5, 0))).toBe(false)
  })
})

describe('shouldShimmer', () => {
  it('plays once per tank when it first holds 100 readings', () => {
    expect(shouldShimmer('a', 99, [])).toBe(false)
    expect(shouldShimmer('a', 100, [])).toBe(true)
    expect(shouldShimmer('a', 101, ['a'])).toBe(false)
    expect(shouldShimmer('b', 100, ['a'])).toBe(true)
  })
})

describe('devClockFromSearch', () => {
  it('starts at the overridden moment and keeps running', () => {
    const real = new Date(2026, 8, 29, 17, 0, 0)
    jest.useFakeTimers({ now: real })
    const clock = devClockFromSearch('?tankDate=2026-12-31T23:59:30', real)
    expect(clock).not.toBeNull()
    expect(clock!().getMonth()).toBe(11)
    expect(devClockFromSearch('?tankPhase=night', real)!().getHours()).toBe(23)
    expect(devClockFromSearch('', real)).toBeNull()
    jest.useRealTimers()
  })
})
