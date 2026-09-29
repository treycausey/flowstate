import type { Metric } from './models'

/** Display a metric value: pH with at least one decimal, ppm without trailing zeros. */
export function formatMetric(metric: Metric, value: number) {
  if (!Number.isFinite(value)) return '—'
  if (metric === 'pH') {
    const fixed = value.toFixed(2)
    return fixed.endsWith('0') ? value.toFixed(1) : fixed
  }
  return String(Number(value.toFixed(2)))
}

export function unitFor(metric: Metric) {
  return metric === 'pH' ? '' : ' ppm'
}
