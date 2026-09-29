import { BOUNDS, METRICS, STEP, type Metric, type MetricValue } from './models'

export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return value
  return Math.min(max, Math.max(min, value))
}

function decimalsOf(step: number) {
  const s = step.toString()
  const idx = s.indexOf('.')
  return idx === -1 ? 0 : s.length - idx - 1
}

export function roundToStep(value: number, step: number) {
  if (Number.isNaN(value)) return value
  const rounded = Math.round(value / step) * step
  const dec = Math.max(0, decimalsOf(step))
  return Number(rounded.toFixed(dec))
}

// Storage precision. Kit steps (STEP) drive the input steppers, but typed values
// are kept at this precision so real kit colors like nitrite 0.25 ppm survive.
const PRECISION: Record<Metric, number> = {
  pH: 0.01,
  ammonia: 0.01,
  nitrite: 0.01,
  nitrate: 0.1,
}

export function normalizeInput(metric: Metric, value: number) {
  const v = Number(value)
  if (Number.isNaN(v)) return v
  const { min, max } = BOUNDS[metric]
  return clamp(roundToStep(v, PRECISION[metric]), min, max)
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

/** Parse a raw form string for a metric; rejects blanks, non-numbers, and out-of-range values. */
export function parseMetricInput(metric: Metric, raw: string): ParseResult {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { ok: false, error: 'Required' }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number' }
  const { min, max } = BOUNDS[metric]
  if (value < min || value > max) return { ok: false, error: `Must be ${min}–${max}` }
  return { ok: true, value: normalizeInput(metric, value) }
}

export type ReadingInputResult =
  | { ok: true; values: Record<Metric, MetricValue> }
  | { ok: false; errors: Partial<Record<Metric, string>>; formError?: string }

/**
 * Parse a form's metric strings. Blank fields mean "not tested" (null); at least one
 * metric must be filled in, and any filled-in value must be valid.
 */
export function parseReadingInputs(raw: Record<Metric, string>): ReadingInputResult {
  const values = {} as Record<Metric, MetricValue>
  const errors: Partial<Record<Metric, string>> = {}
  for (const m of METRICS) {
    if (raw[m].trim() === '') {
      values[m] = null
      continue
    }
    const res = parseMetricInput(m, raw[m])
    if (res.ok) values[m] = res.value
    else errors[m] = res.error
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  if (METRICS.every((m) => values[m] === null)) {
    return { ok: false, errors: {}, formError: 'Enter at least one test result.' }
  }
  return { ok: true, values }
}

/**
 * Step a metric's raw text by one kit step (ArrowUp/ArrowDown on a text field).
 * Blank or unparseable text starts from the metric's minimum. Result is clamped to bounds.
 */
export function stepMetricText(metric: Metric, raw: string, direction: 1 | -1): string {
  const { min, max } = BOUNDS[metric]
  const current = Number(raw.trim().replace(',', '.'))
  const base =
    raw.trim() === '' || !Number.isFinite(current) ? min - direction * STEP[metric] : current
  const next = clamp(roundToStep(base + direction * STEP[metric], PRECISION[metric]), min, max)
  return String(next)
}
