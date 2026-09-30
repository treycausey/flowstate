import { NITRATE_CAUTION_MAX, OPTIMAL, type Metric } from './models'

export type FieldHint = {
  /** danger: toxic to fish; caution: worth watching or acting on */
  tone: 'danger' | 'caution'
  text: string
}

/**
 * Display-only hint for the value currently typed or selected in a metric field.
 * Blank or unparseable text gives no hint (validation reports those on save).
 */
export function fieldHint(metric: Metric, raw: string): FieldHint | null {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null

  if ((metric === 'ammonia' || metric === 'nitrite') && value > 0) {
    return { tone: 'danger', text: 'Above 0 — toxic to fish' }
  }
  if (metric === 'nitrate') {
    if (value > NITRATE_CAUTION_MAX) {
      return { tone: 'caution', text: `High — above ${NITRATE_CAUTION_MAX} ppm` }
    }
    if (value > OPTIMAL.nitrate.max) {
      return {
        tone: 'caution',
        text: `Caution — ${OPTIMAL.nitrate.max} to ${NITRATE_CAUTION_MAX} ppm`,
      }
    }
  }
  return null
}
