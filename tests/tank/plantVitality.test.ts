import { withPlantVitality } from '@/lib/tank/fromReadings'
import { NEUTRAL_WATER, type WaterState } from '@/lib/tank/waterState'

const base: WaterState = { ...NEUTRAL_WATER, algae: 0.2, sparkle: 0.5 }

describe('withPlantVitality', () => {
  it('changes nothing without plants or with middling plants', () => {
    expect(withPlantVitality(base, null)).toBe(base)
    expect(withPlantVitality(base, 0.5)).toBe(base)
    expect(withPlantVitality(base, 0.8)).toBe(base)
    expect(withPlantVitality(base, Number.NaN)).toBe(base)
  })

  it('raises algae and dulls the sparkle when plants struggle, a little', () => {
    const w = withPlantVitality(base, 0)
    expect(w.algae).toBeGreaterThan(base.algae)
    expect(w.algae - base.algae).toBeLessThanOrEqual(0.15 + 1e-9)
    expect(w.sparkle).toBeLessThan(base.sparkle)
    const mild = withPlantVitality(base, 0.4)
    expect(mild.algae).toBeGreaterThan(base.algae)
    expect(mild.algae).toBeLessThan(w.algae)
  })

  it('adds a touch of sparkle for thriving plants and stays within 0..1', () => {
    const w = withPlantVitality(base, 1)
    expect(w.sparkle).toBeGreaterThan(base.sparkle)
    expect(w.sparkle - base.sparkle).toBeLessThanOrEqual(0.15 + 1e-9)
    expect(w.algae).toBe(base.algae)
    expect(withPlantVitality({ ...base, sparkle: 0.95, algae: 0.95 }, 0).algae).toBeLessThanOrEqual(
      1,
    )
    expect(withPlantVitality({ ...base, sparkle: 0.95 }, 1).sparkle).toBeLessThanOrEqual(1)
  })
})
