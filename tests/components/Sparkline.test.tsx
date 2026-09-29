// The sparkline drawing has no accessible role, so these tests inspect the SVG directly.
/* eslint-disable testing-library/no-container */
import { render, screen } from '@testing-library/react'
import Sparkline, { sparkTrend, sparklinePoints } from '@/components/charts/Sparkline'

describe('Sparkline', () => {
  it('hides the drawing from assistive tech and summarises the trend in text', () => {
    const { container } = render(<Sparkline values={[1, 2, 4]} label="NH3" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('NH3: rising over the last 3 tests')).toBeInTheDocument()
  })

  it('draws the smallest value at the bottom and the largest at the top', () => {
    const pts = sparklinePoints([5, 10, 7.5])
    expect(pts[1][1]).toBeLessThan(pts[2][1])
    expect(pts[2][1]).toBeLessThan(pts[0][1])
    expect(pts[0][0]).toBeLessThan(pts[2][0])
  })

  it('puts a flat series on one line and reports steady', () => {
    const ys = sparklinePoints([0, 0, 0]).map(([, y]) => y)
    expect(new Set(ys).size).toBe(1)
    expect(sparkTrend([0, 0, 0])).toBe('steady')
    expect(sparkTrend([3, 2, 1])).toBe('falling')
  })

  it('renders nothing without data and a plain note for a single test', () => {
    const { container, rerender } = render(<Sparkline values={[]} label="pH" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<Sparkline values={[7]} label="pH" />)
    expect(screen.getByText('pH: one test so far')).toBeInTheDocument()
  })

  it('colours out-of-range metrics through the tone class', () => {
    const { container } = render(<Sparkline values={[0, 0.5]} label="NH3" tone="high" />)
    expect(container.querySelector('svg')).toHaveClass('spark--high')
  })
})
