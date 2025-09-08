import { STEP } from './models'

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

export function normalizeInput(metric: 'pH' | 'ammonia' | 'nitrite' | 'nitrate', value: number) {
  const v = Number(value)
  if (Number.isNaN(v)) return v
  switch (metric) {
    case 'pH':
      return clamp(roundToStep(v, STEP.pH), 5, 9)
    case 'ammonia':
      return clamp(roundToStep(v, STEP.ammonia), 0, 10)
    case 'nitrite':
      return clamp(roundToStep(v, STEP.nitrite), 0, 10)
    case 'nitrate':
      return clamp(roundToStep(v, STEP.nitrate), 0, 200)
  }
}
