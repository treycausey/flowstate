'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { domainY, padTimeDomain, severity, type Point } from '@/lib/series'
import { NITRATE_CAUTION_MAX, OPTIMAL, type Metric } from '@/lib/models'
import { formatMetric, unitFor } from '@/lib/format'
import { formatLocal } from '@/lib/time'

type Props = {
  metric: Metric
  points: Point[]
  /** Shared time domain (ms) so small multiples line up; defaults to the points' extent */
  xDomain?: [number, number]
  width?: number // if omitted, chart fills parent width
  height?: number
  showAxisLabels?: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

function niceStep(min: number, max: number, count: number) {
  const span = Math.max(1e-9, max - min)
  const step0 = span / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const err = step0 / mag
  return err >= 7 ? 10 * mag : err >= 3 ? 5 * mag : err >= 1.5 ? 2 * mag : mag
}

function linearTicks(min: number, max: number, count: number) {
  const s = niceStep(min, max, count)
  const ticks: number[] = []
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s)
    ticks.push(Number((Math.round(v / s) * s).toFixed(6)))
  return ticks
}

function timeTicks(x0: number, x1: number, maxTicks: number) {
  if (x1 <= x0) return [x0]
  return Array.from(
    { length: maxTicks },
    (_, i) => x0 + Math.round((i / (maxTicks - 1)) * (x1 - x0)),
  )
}

export default function MetricChart({
  metric,
  points,
  xDomain,
  width,
  height = 100,
  showAxisLabels = true,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<number | null>(null)
  // The inspected point belongs to one `points` array; new data implicitly clears it
  const [inspected, setInspected] = useState<{ points: Point[]; index: number } | null>(null)
  const active = inspected?.points === points ? inspected.index : null
  const setActive = (update: number | null | ((prev: number | null) => number | null)) => {
    const index = typeof update === 'function' ? update(active) : update
    setInspected(index === null ? null : { points, index })
  }
  const clipId = `clip-${useId().replace(/:/g, '')}`

  useEffect(() => {
    if (width) return
    const el = wrapperRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setMeasured(Math.max(0, Math.floor(e.contentRect.width)))
    })
    obs.observe(el)
    setMeasured(Math.max(0, Math.floor(el.clientWidth)))
    return () => obs.disconnect()
  }, [width])

  const resolvedW = width ?? (measured && measured > 0 ? measured : 320)
  const margin = { left: 40, right: 12, top: 8, bottom: showAxisLabels ? 32 : 20 }
  const innerW = Math.max(0, resolvedW - margin.left - margin.right)
  const innerH = Math.max(0, height - margin.top - margin.bottom)

  if (points.length === 0) {
    return (
      <div ref={wrapperRef} className="chart-empty" style={{ height }}>
        No data in this range
      </div>
    )
  }

  const times = points.map((p) => new Date(p.ts).getTime())
  const [x0, x1] = padTimeDomain(...(xDomain ?? [Math.min(...times), Math.max(...times)]))
  const [y0, y1] = domainY(
    metric,
    points.map((p) => p.value),
  )
  const sx = (t: number) => ((t - x0) / (x1 - x0)) * innerW + margin.left
  const sy = (v: number) => margin.top + innerH - ((v - y0) / (y1 - y0 || 1)) * innerH
  const band = (lo: number, hi: number) => {
    const top = sy(Math.min(hi, y1))
    const bottom = sy(Math.max(lo, y0))
    return { y: top, height: Math.max(0, bottom - top) }
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(times[i])},${sy(p.value)}`).join(' ')
  const yTicks = linearTicks(y0, y1, 4)
  const dtShort = new Intl.DateTimeFormat(
    undefined,
    x1 - x0 > 1.5 * DAY_MS
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', hour: 'numeric' },
  )

  // Never label two ticks with the same text
  const xTicks: { t: number; label: string }[] = []
  for (const t of timeTicks(x0, x1, resolvedW < 360 ? 3 : 4)) {
    const label = dtShort.format(new Date(t))
    if (!xTicks.some((tick) => tick.label === label)) xTicks.push({ t, label })
  }

  const nearestIndex = (clientX: number, svg: SVGSVGElement) => {
    const rect = svg.getBoundingClientRect()
    const x = clientX - rect.left
    let best = 0
    for (let i = 1; i < times.length; i++) {
      if (Math.abs(sx(times[i]) - x) < Math.abs(sx(times[best]) - x)) best = i
    }
    return best
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const dir = e.key === 'ArrowRight' ? 1 : -1
      setActive((i) =>
        i === null
          ? dir > 0
            ? 0
            : points.length - 1
          : Math.min(points.length - 1, Math.max(0, i + dir)),
      )
    } else if (e.key === 'Escape') {
      setActive(null)
    }
  }

  const activePoint = active !== null ? points[active] : null
  const label = `${metric} over time, ${points.length} reading${points.length === 1 ? '' : 's'}. Use left and right arrow keys to inspect values.`

  return (
    <div ref={wrapperRef} className="metric-chart">
      <svg
        width={resolvedW}
        height={height}
        role="img"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setActive(nearestIndex(e.clientX, e.currentTarget))}
        onPointerDown={(e) => setActive(nearestIndex(e.clientX, e.currentTarget))}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
        onBlur={() => setActive(null)}
        style={{ touchAction: 'pan-y', display: 'block' }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={margin.left} y={margin.top - 3} width={innerW} height={innerH + 6} />
          </clipPath>
        </defs>
        {/* Optimal / caution bands, clipped to the plot area */}
        {metric === 'pH' && (
          <rect
            x={margin.left}
            width={innerW}
            {...band(OPTIMAL.pH.min, OPTIMAL.pH.max)}
            fill="var(--band-ok)"
          />
        )}
        {metric === 'nitrate' && (
          <>
            <rect x={margin.left} width={innerW} {...band(0, 20)} fill="var(--band-ok)" />
            <rect
              x={margin.left}
              width={innerW}
              {...band(OPTIMAL.nitrate.max, NITRATE_CAUTION_MAX)}
              fill="var(--band-caution)"
            />
          </>
        )}
        {yTicks.map((yt) => (
          <g key={`y-${yt}`}>
            <line
              x1={margin.left}
              x2={margin.left + innerW}
              y1={sy(yt)}
              y2={sy(yt)}
              stroke="var(--grid)"
            />
            <text
              x={margin.left - 6}
              y={sy(yt) + 3}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="10"
            >
              {metric === 'pH' ? yt.toFixed(1) : formatMetric(metric, yt)}
            </text>
          </g>
        ))}
        {xTicks.map(({ t, label }, i) => (
          <text
            key={`x-${i}`}
            x={sx(t)}
            y={margin.top + innerH + 14}
            textAnchor={x1 <= x0 ? 'middle' : t <= x0 ? 'start' : t >= x1 ? 'end' : 'middle'}
            fill="var(--muted)"
            fontSize="10"
          >
            {label}
          </text>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {activePoint && active !== null && (
            <line
              x1={sx(times[active])}
              x2={sx(times[active])}
              y1={margin.top}
              y2={margin.top + innerH}
              stroke="var(--muted)"
              strokeDasharray="2 2"
            />
          )}
          <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.25} />
          {points.map((p, i) => {
            const level = severity(metric, p.value)
            const cx = sx(times[i])
            const cy = sy(p.value)
            if (level === 'ok')
              return (
                <circle key={i} cx={cx} cy={cy} r={i === active ? 3.5 : 1.8} fill="var(--ink)" />
              )
            // Out-of-range: hollow ring + dot, so it reads without relying on color alone
            const color = level === 'high' ? 'var(--danger)' : 'var(--caution)'
            return (
              <g key={i} data-anomaly={level}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={i === active ? 5 : 3.8}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
                <circle cx={cx} cy={cy} r={1.6} fill={color} />
              </g>
            )
          })}
        </g>
        {showAxisLabels && (
          <text
            transform={`translate(10 ${margin.top + innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="10"
          >
            {metric === 'pH' ? 'pH' : 'ppm'}
          </text>
        )}
      </svg>
      <div className="chart-readout" aria-live="polite">
        {activePoint ? (
          <>
            <strong>
              {formatMetric(metric, activePoint.value)}
              {unitFor(metric)}
            </strong>{' '}
            · {formatLocal(new Date(activePoint.ts))}
            {activePoint.note ? <> · {activePoint.note}</> : null}
          </>
        ) : (
          ' '
        )}
      </div>
    </div>
  )
}
