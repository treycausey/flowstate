type Props = {
  /** Tested values, oldest first (the last ~10). */
  values: number[]
  /** Metric name for the screen-reader summary, e.g. "NH3". */
  label: string
  /** Colours the line: out-of-range metrics use the caution/danger tokens. */
  tone?: 'ok' | 'caution' | 'high'
}

const W = 60
const H = 20
const PAD = 2

export type SparkTrend = 'rising' | 'falling' | 'steady'

/** Points in a W×H box; a flat series sits on the centre line, a lone value is a short segment. */
export function sparklinePoints(values: number[]): [number, number][] {
  if (values.length === 0) return []
  if (values.length === 1) return [[W - 18, H / 2] as [number, number], [W - PAD, H / 2]]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  return values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - 2 * PAD)
    const y = span < 1e-9 ? H / 2 : H - PAD - ((v - min) / span) * (H - 2 * PAD)
    return [x, y]
  })
}

/** Latest value against the first one in the window. */
export function sparkTrend(values: number[]): SparkTrend {
  if (values.length < 2) return 'steady'
  const diff = values[values.length - 1] - values[0]
  if (Math.abs(diff) < 1e-9) return 'steady'
  return diff > 0 ? 'rising' : 'falling'
}

/** Tiny custom-SVG trend line. The drawing is decorative; the text summary is for screen readers. */
export default function Sparkline({ values, label, tone = 'ok' }: Props) {
  const points = sparklinePoints(values)
  if (points.length === 0) return null
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = points[points.length - 1]
  const summary =
    values.length < 2
      ? `${label}: one test so far`
      : `${label}: ${sparkTrend(values)} over the last ${values.length} tests`
  return (
    <>
      <svg
        className={tone === 'ok' ? 'spark' : `spark spark--${tone}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lx} cy={ly} r={1.8} fill="currentColor" />
      </svg>
      <span className="visually-hidden">{summary}</span>
    </>
  )
}
