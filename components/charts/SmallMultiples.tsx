"use client"

import MetricChart from './MetricChart'
import { rollingAverage } from '@/lib/series'

type Metric = 'pH' | 'ammonia' | 'nitrite' | 'nitrate'

export default function SmallMultiples({
  series,
  valueMode = 'latest',
}: {
  series: Record<Metric, { ts: string; value: number }[]>
  valueMode?: 'latest' | 'rolling'
}) {
  const notes: Record<Metric, string> = {
    pH: 'Optimal 6.5–7.5',
    ammonia: 'Target 0 ppm (NH3)',
    nitrite: 'Target 0 ppm (NO2)',
    nitrate: 'Optimal 0–20 ppm; 20–40 caution (NO3)',
  }
  function formatValue(metric: Metric, v: number) {
    if (metric === 'pH') return v.toFixed(1)
    return v >= 1 ? v.toFixed(0) : v.toFixed(2)
  }

  const labelText = valueMode === 'rolling' ? '7‑day avg' : 'Latest'

  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {(Object.keys(series) as Metric[]).map((m, idx) => {
        const pts = series[m]
        const last = pts.length ? pts[pts.length - 1].value : null
        // 7-day average display value: use last of rolling series if valueMode=rolling,
        // otherwise compute rolling over raw points and take the last.
        const avg7 = (() => {
          if (pts.length === 0) return null
          if (valueMode === 'rolling') return last
          const rolled = rollingAverage(pts, 7)
          return rolled.length ? rolled[rolled.length - 1].value : null
        })()
        return (
          <div
            key={m}
            style={{ padding: '8px 0 10px 0', borderBottom: '1px solid var(--border)' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 4,
                color: 'var(--muted)',
                fontSize: 12,
              }}
            >
              <div>
                {m.toUpperCase()} {avg7 != null && (
                  <span aria-label={`${m} 7-day average`} style={{ marginLeft: 6 }}>
                    7‑day avg: <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>
                      {formatValue(m, avg7)}{m === 'pH' ? '' : ' ppm'}
                    </strong>
                  </span>
                )}
              </div>
              {last != null && (
                <div aria-label={`${m} ${labelText} value`} style={{ whiteSpace: 'nowrap' }}>
                  {labelText}: <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>
                    {formatValue(m, last)}{m === 'pH' ? '' : ' ppm'}
                  </strong>
                </div>
              )}
            </div>
            <MetricChart metric={m} points={pts} height={120} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{notes[m]}</div>
          </div>
        )
      })}
    </div>
  )
}
