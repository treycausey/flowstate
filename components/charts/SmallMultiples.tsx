'use client'

import { useMemo } from 'react'
import MetricChart from './MetricChart'
import { anomalyCount, type MetricSeries } from '@/lib/series'
import { METRICS, METRIC_LABEL, type Metric } from '@/lib/models'
import { formatMetric, unitFor } from '@/lib/format'

const NOTES: Record<Metric, string> = {
  pH: 'Optimal 6.5–7.5',
  ammonia: 'Target 0 ppm',
  nitrite: 'Target 0 ppm',
  nitrate: 'Optimal 0–20 ppm · 20–40 caution · >40 high',
}

export default function SmallMultiples({
  series,
  valueMode = 'latest',
  xDomain,
  chartHeight = 120,
  anomalySource,
}: {
  series: MetricSeries
  valueMode?: 'latest' | 'rolling'
  /** Override the shared time axis (e.g. a report's 30-day window) */
  xDomain?: [number, number]
  chartHeight?: number
  /** Raw series for out-of-range counts when `series` is smoothed */
  anomalySource?: MetricSeries
}) {
  // One shared time axis across all panels (FR-3.1)
  const sharedDomain = useMemo<[number, number] | undefined>(() => {
    if (xDomain) return xDomain
    const times = METRICS.flatMap((m) => series[m].map((p) => new Date(p.ts).getTime()))
    return times.length ? [Math.min(...times), Math.max(...times)] : undefined
  }, [series, xDomain])

  const labelText = valueMode === 'rolling' ? '7‑day avg' : 'Latest'

  return (
    <div className="small-multiples">
      {METRICS.map((m) => {
        const pts = series[m]
        const last = pts.length ? pts[pts.length - 1].value : null
        const flagged = anomalyCount(m, (anomalySource ?? series)[m])
        return (
          <section key={m} className="panel" aria-label={METRIC_LABEL[m]}>
            <div className="panel-head">
              <h3 className="panel-title">{METRIC_LABEL[m]}</h3>
              {last != null && (
                <div aria-label={`${m} ${labelText} value`} className="nowrap">
                  {labelText}:{' '}
                  <strong>
                    {formatMetric(m, last)}
                    {unitFor(m)}
                  </strong>
                </div>
              )}
            </div>
            <MetricChart metric={m} points={pts} xDomain={sharedDomain} height={chartHeight} />
            <div className="panel-foot">
              <span>{NOTES[m]}</span>
              {pts.length > 0 && (
                <span className={flagged ? 'flag flag--high' : undefined}>
                  {flagged} out of range
                </span>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
