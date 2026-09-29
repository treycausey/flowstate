// SVG geometry (markers, tick labels, path data) has no accessible role, so these tests
// inspect the rendered SVG directly.
/* eslint-disable testing-library/no-container */
import { fireEvent, render, screen } from '@testing-library/react'
import MetricChart from '@/components/charts/MetricChart'

const pts = [
  { ts: '2024-01-01T00:00:00.000Z', value: 0 },
  { ts: '2024-01-02T00:00:00.000Z', value: 0.5, note: 'fed heavily' },
  { ts: '2024-01-03T00:00:00.000Z', value: 0 },
]

describe('MetricChart', () => {
  it('marks out-of-range points with a distinct shape', () => {
    const { container } = render(<MetricChart metric="ammonia" points={pts} width={400} />)
    expect(container.querySelectorAll('[data-anomaly]')).toHaveLength(1)
  })

  it('never draws negative ppm tick labels', () => {
    const { container } = render(<MetricChart metric="nitrite" points={pts} width={400} />)
    const labels = Array.from(container.querySelectorAll('text')).map((t) => t.textContent ?? '')
    expect(labels.some((l) => l.startsWith('-'))).toBe(false)
  })

  it('shows value, time, and note for the inspected point via keyboard', () => {
    render(<MetricChart metric="ammonia" points={pts} width={400} />)
    const chart = screen.getByRole('img')
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByText(/fed heavily/)).toBeInTheDocument()
    expect(screen.getByText('0.5 ppm')).toBeInTheDocument()
  })

  it('renders a single reading without errors', () => {
    const { container } = render(
      <MetricChart metric="pH" points={[{ ts: pts[0].ts, value: 7 }]} width={300} />,
    )
    expect(container.querySelector('path')?.getAttribute('d')).not.toContain('NaN')
  })

  it('gives a single reading one distinct x tick per label and a centred point', () => {
    const { container } = render(
      <MetricChart metric="pH" points={[{ ts: pts[0].ts, value: 7 }]} width={300} />,
    )
    const labels = Array.from(container.querySelectorAll('text'))
      .map((t) => t.textContent ?? '')
      .filter((l) => /[A-Z][a-z]{2} \d/.test(l))
    expect(labels.length).toBeGreaterThan(1)
    expect(new Set(labels).size).toBe(labels.length)
    const cx = Number(container.querySelector('circle')?.getAttribute('cx'))
    expect(cx).toBeCloseTo(40 + (300 - 40 - 12) / 2, 3)
  })

  it('never repeats an x tick label when the shared domain is under an hour wide', () => {
    const t0 = new Date(pts[0].ts).getTime()
    const { container } = render(
      <MetricChart
        metric="pH"
        points={[{ ts: pts[0].ts, value: 7 }]}
        xDomain={[t0, t0 + 20 * 60 * 1000]}
        width={300}
      />,
    )
    const labels = Array.from(container.querySelectorAll('text'))
      .map((t) => t.textContent ?? '')
      .filter((l) => /[A-Z][a-z]{2} \d/.test(l))
    expect(new Set(labels).size).toBe(labels.length)
    const cx = Number(container.querySelector('circle')?.getAttribute('cx'))
    expect(cx).toBeGreaterThan(40)
    expect(cx).toBeLessThan(300 - 12)
  })

  it('shows an empty state', () => {
    render(<MetricChart metric="pH" points={[]} width={300} />)
    expect(screen.getByText(/no data/i)).toBeInTheDocument()
  })
})
