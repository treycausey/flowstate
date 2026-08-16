import { OPTIMAL } from './models'

export type Point = { ts: string; value: number }

export function rollingAverage(points: Point[], windowDays: number): Point[] {
  if (windowDays <= 1) return points
  const out: Point[] = []
  const windowMs = (windowDays - 1) * 24 * 60 * 60 * 1000
  for (let i = 0; i < points.length; i++) {
    const curr = new Date(points[i].ts).getTime()
    const from = curr - windowMs
    const slice = points.filter(
      (p) => new Date(p.ts).getTime() >= from && new Date(p.ts).getTime() <= curr,
    )
    const avg = slice.reduce((s, p) => s + p.value, 0) / (slice.length || 1)
    out.push({ ts: points[i].ts, value: Number(avg.toFixed(3)) })
  }
  return out
}

export function isOutOfRange(metric: 'pH' | 'ammonia' | 'nitrite' | 'nitrate', value: number) {
  const band = OPTIMAL[metric as keyof typeof OPTIMAL] as any
  if (metric === 'ammonia' || metric === 'nitrite') return value > 0
  if ('min' in band && value < band.min) return true
  if ('max' in band && value > band.max) return true
  return false
}

export function domainY(metric: 'pH' | 'ammonia' | 'nitrite' | 'nitrate', values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = metric === 'pH' ? 0.2 : 2
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10]
}

export function anomalyCount(metric: 'pH' | 'ammonia' | 'nitrite' | 'nitrate', points: Point[]) {
  return points.reduce((n, p) => n + (isOutOfRange(metric, p.value) ? 1 : 0), 0)
}
