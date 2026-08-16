'use client'

import { isOutOfRange, domainY } from '@/lib/series'
import { useEffect, useRef, useState } from 'react'

type Props = {
  metric: 'pH' | 'ammonia' | 'nitrite' | 'nitrate'
  points: { ts: string; value: number }[]
  width?: number // if omitted, chart fills parent width
  height?: number
  showAxisLabels?: boolean
}

export default function MetricChart({
  metric,
  points,
  width,
  height = 100,
  showAxisLabels = true,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState<number | null>(null)

  useEffect(() => {
    if (width) {
      setW(width)
      return
    }
    const el = wrapperRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(0, Math.floor(e.contentRect.width)))
    })
    obs.observe(el)
    setW(Math.max(0, Math.floor(el.clientWidth)))
    return () => obs.disconnect()
  }, [width])

  const resolvedW = width ?? (w && w > 0 ? w : 320)
  const margin = { left: 40, right: 16, top: 12, bottom: 32 }
  const innerW = Math.max(0, resolvedW - margin.left - margin.right)
  const innerH = Math.max(0, height - margin.top - margin.bottom)

  if (points.length === 0) return <div ref={wrapperRef} style={{ width: '100%', height }} />
  if (!resolvedW) return <div ref={wrapperRef} style={{ width: '100%', height }} />

  const times = points.map((p) => new Date(p.ts).getTime())
  const values = points.map((p) => p.value)
  const x0 = Math.min(...times)
  const x1 = Math.max(...times)
  const [y0, y1] = domainY(metric, values)
  const sx = (t: number) => ((t - x0) / (x1 - x0 || 1)) * innerW + margin.left
  const sy = (v: number) => height - margin.bottom - ((v - y0) / (y1 - y0 || 1)) * innerH
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${sx(new Date(p.ts).getTime())},${sy(p.value)}`)
    .join(' ')

  const yLabel = metric === 'pH' ? 'pH' : 'ppm'

  // Tick helpers (lightweight "nice" ticks)
  function niceStep(min: number, max: number, count: number) {
    const span = Math.max(1e-9, max - min)
    const step0 = span / Math.max(1, count)
    const mag = Math.pow(10, Math.floor(Math.log10(step0)))
    const err = step0 / mag
    const step = err >= 7 ? 10 * mag : err >= 3 ? 5 * mag : err >= 1.5 ? 2 * mag : mag
    return step
  }
  function linearTicks(min: number, max: number, count: number) {
    const s = niceStep(min, max, count)
    const start = Math.ceil(min / s) * s
    const ticks: number[] = []
    for (let v = start; v <= max + 1e-9; v += s)
      ticks.push(Number((Math.round(v / s) * s).toFixed(6)))
    return ticks
  }
  const yTicks = linearTicks(y0, y1, 4)
  const spanMs = Math.max(1, x1 - x0)
  const xTickCount = 4
  const xTicks = Array.from(
    { length: xTickCount },
    (_, i) => x0 + Math.round((i / (xTickCount - 1)) * spanMs),
  )
  const dtShort =
    spanMs > 1000 * 60 * 60 * 24 * 3
      ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
      : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div ref={wrapperRef} style={{ width: '100%' }}>
      <svg width={resolvedW} height={height} aria-label={`${metric} chart`}>
        <rect x={0} y={0} width={resolvedW} height={height} fill="none" />
        {/* Optimal band shading for pH and nitrate */}
        {metric === 'pH' && (
          <rect
            x={margin.left}
            y={sy(7.5)}
            width={innerW}
            height={Math.max(0, sy(6.5) - sy(7.5))}
            fill="var(--band-ph)"
          />
        )}
        {metric === 'nitrate' && (
          <>
            {/* Optimal 0-20 ppm */}
            <rect
              x={margin.left}
              y={sy(20)}
              width={innerW}
              height={Math.max(0, sy(0) - sy(20))}
              fill="var(--band-ok)"
            />
            {/* Caution 20-40 ppm */}
            <rect
              x={margin.left}
              y={sy(40)}
              width={innerW}
              height={Math.max(0, sy(20) - sy(40))}
              fill="var(--band-caution)"
            />
          </>
        )}
        {/* Gridlines (horizontal) */}
        {yTicks.map((yt, i) => (
          <line
            key={`yg-${i}`}
            x1={margin.left}
            x2={margin.left + innerW}
            y1={sy(yt)}
            y2={sy(yt)}
            stroke="var(--border)"
            strokeOpacity={0.35}
          />
        ))}
        {/* Axes ticks and labels */}
        {/* Y ticks */}
        {yTicks.map((yt, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={margin.left - 4}
              x2={margin.left}
              y1={sy(yt)}
              y2={sy(yt)}
              stroke="var(--border)"
            />
            <text
              x={margin.left - 6}
              y={sy(yt) + 3}
              textAnchor="end"
              fill="var(--muted)"
              fontSize="10"
            >
              {metric === 'pH' ? yt.toFixed(1) : yt >= 1 ? yt.toFixed(0) : yt.toFixed(2)}
            </text>
          </g>
        ))}
        {/* X ticks */}
        {xTicks.map((xt, i) => (
          <g key={`xt-${i}`}>
            <line
              x1={sx(xt)}
              x2={sx(xt)}
              y1={height - margin.bottom}
              y2={height - margin.bottom + 4}
              stroke="var(--border)"
            />
            <text
              x={sx(xt)}
              y={height - margin.bottom + 14}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="10"
            >
              {dtShort.format(new Date(xt))}
            </text>
          </g>
        ))}
        {/* series line */}
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1} />
        {/* anomalies */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={sx(new Date(p.ts).getTime())}
            cy={sy(p.value)}
            r={isOutOfRange(metric, p.value) ? 2.2 : 1.6}
            fill={isOutOfRange(metric, p.value) ? 'var(--danger)' : 'var(--ink)'}
          />
        ))}
        {showAxisLabels && (
          <>
            {/* X label */}
            <text
              x={margin.left + innerW / 2}
              y={height - 6}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="10"
            >
              Time
            </text>
            {/* Y label */}
            <text
              transform={`translate(10 ${margin.top + innerH / 2}) rotate(-90)`}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="10"
            >
              {yLabel}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
