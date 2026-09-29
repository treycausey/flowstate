import type { Metric } from './models'

/**
 * Colour-card values on the API Freshwater Master Test Kit, per metric. These are the
 * values a person can read off the card, so each one is a valid reading.
 */
export const KIT_VALUES: Record<Metric, readonly number[]> = {
  pH: [6.0, 6.4, 6.6, 6.8, 7.0, 7.2, 7.6],
  ammonia: [0, 0.25, 0.5, 1, 2, 4, 8],
  nitrite: [0, 0.25, 0.5, 1, 2, 5],
  nitrate: [0, 5, 10, 20, 40, 80, 160],
}

/** Colour card of the separate API High Range pH test kit. */
export const KIT_PH_HIGH_RANGE: readonly number[] = [7.4, 7.8, 8.0, 8.2, 8.4, 8.8]

/** Chip label: pH shows one decimal (7.0), other metrics show the plain number. */
export function formatKitValue(metric: Metric, value: number) {
  return metric === 'pH' ? value.toFixed(1) : String(value)
}

/** True when the raw field text equals the chip's value. Blank never matches. */
export function isKitValueSelected(raw: string, value: number) {
  const trimmed = raw.trim().replace(',', '.')
  return trimmed !== '' && Number(trimmed) === value
}
