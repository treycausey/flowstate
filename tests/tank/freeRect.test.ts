import { BettaSim } from '@/lib/tank/betta'
import { exclusionFor } from '@/components/tank/TankHost'

describe('largest free rectangle', () => {
  // Charts on a 1440x900 desktop: the panel is ~58% wide and stops well short of the bottom.
  const chartsPanel = { left: 0, top: 0.06 * 900, right: 0.58 * 1440, bottom: 0.4 * 900 }

  it('picks the strip below a short wide panel (why the panel must count as a full-height column)', () => {
    const ex = {
      x0: chartsPanel.left / 1440,
      y0: chartsPanel.top / 900,
      x1: chartsPanel.right / 1440,
      y1: chartsPanel.bottom / 900,
    }
    const sim = new BettaSim(1, { aspect: 1.6, fishWidth: 0.19, exclusion: ex })
    expect(sim.freeRect().x0).toBe(0)
    expect(sim.freeRect().y0).toBeGreaterThanOrEqual(ex.y1)
  })

  it('treats a desktop panel as a full-height column so the fish gets the open water beside it', () => {
    const ex = exclusionFor(chartsPanel, 1440, 900)
    expect(ex).toEqual({ left: 0, right: chartsPanel.right, top: 0, bottom: 900 })
    const sim = new BettaSim(1, {
      aspect: 1.6,
      fishWidth: 0.19,
      exclusion: { x0: ex.left / 1440, y0: ex.top / 900, x1: ex.right / 1440, y1: ex.bottom / 900 },
    })
    const free = sim.freeRect()
    expect(free.x0).toBeCloseTo(0.58, 5)
    expect(free.x1).toBe(1)
    expect(free.y0).toBeLessThan(0.1)
    expect(free.y1).toBeGreaterThan(0.85)
  })

  it('keeps the phone sheet as a band below the hero', () => {
    const ex = exclusionFor({ left: 0, top: 500, right: 375, bottom: 900 }, 375, 812)
    expect(ex.left).toBe(0)
    expect(ex.right).toBe(375)
    expect(ex.top).toBe(500)
  })

  it('never lets the phone band shrink below 30% of the height when the sheet is scrolled up', () => {
    const ex = exclusionFor({ left: 0, top: 100, right: 375, bottom: 900 }, 375, 812)
    expect(ex.top).toBeCloseTo(0.3 * 812, 5)
    const wide = exclusionFor({ left: 0, top: 50, right: 844, bottom: 390 }, 844, 390)
    expect(wide.top).toBeCloseTo(0.3 * 390, 5)
  })
})
