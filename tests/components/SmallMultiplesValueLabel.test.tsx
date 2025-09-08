import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import SmallMultiples from '@/components/charts/SmallMultiples'
import { generateSeries } from '@/lib/sim'

describe('SmallMultiples value label', () => {
  test('shows Latest label by default', () => {
    const series = generateSeries({ days: 7, pointsPerDay: 1, seed: 3 })
    render(<SmallMultiples series={series as any} />)
    const latestBadges = screen.getAllByText(/Latest:/i)
    expect(latestBadges.length).toBeGreaterThanOrEqual(4)
  })

  test('shows 7-day avg label when rolling', () => {
    const series = generateSeries({ days: 7, pointsPerDay: 1, seed: 5 })
    render(<SmallMultiples series={series as any} valueMode="rolling" />)
    const avgBadges = screen.getAllByText(/7‑day avg:/i)
    expect(avgBadges.length).toBeGreaterThanOrEqual(4)
  })
})

