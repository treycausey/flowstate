import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SmallMultiples from '@/components/charts/SmallMultiples'
import { generateSeries } from '@/lib/sim'

describe('Simulated charts', () => {
  test('generator returns expected shapes and sizes', () => {
    const series = generateSeries({ days: 10, pointsPerDay: 2, seed: 7 })
    const count = 10 * 2
    expect(series.pH).toHaveLength(count)
    expect(series.ammonia).toHaveLength(count)
    expect(series.nitrite).toHaveLength(count)
    expect(series.nitrate).toHaveLength(count)
    // sanity check bounds
    for (const p of series.pH) expect(p.value).toBeGreaterThanOrEqual(6.0)
    for (const p of series.ammonia) expect(p.value).toBeGreaterThanOrEqual(0)
  })

  test('SmallMultiples renders charts with points', () => {
    const series = generateSeries({ days: 7, pointsPerDay: 1, seed: 1 })
    render(<SmallMultiples series={series as any} />)
    // Four charts (pH, NH3, NO2, NO3)
    const labeled = screen.queryAllByLabelText(/chart/i)
    if (labeled.length > 0) {
      expect(labeled.length).toBeGreaterThanOrEqual(4)
    } else {
      // Fallback for environments not mapping aria-label on SVG
      expect(document.querySelectorAll('svg').length).toBeGreaterThanOrEqual(4)
    }
    // At least one point circle exists
    expect(document.querySelectorAll('svg circle').length).toBeGreaterThan(0)
    // And paths for series lines
    expect(document.querySelectorAll('svg path').length).toBeGreaterThan(0)
  })
})
