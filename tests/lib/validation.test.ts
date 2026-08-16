import { normalizeInput } from '@/lib/validation'

describe('validation/normalizeInput', () => {
  it('rounds to kit steps and clamps ranges', () => {
    expect(normalizeInput('pH', 7.14)).toBe(7.1)
    expect(normalizeInput('ammonia', 0.37)).toBe(0.25)
    expect(normalizeInput('nitrite', 0.08)).toBe(0.1)
    expect(normalizeInput('nitrate', 21.4)).toBe(21)
    expect(normalizeInput('pH', 10)).toBe(9)
    expect(normalizeInput('pH', 4)).toBe(5)
  })
})
