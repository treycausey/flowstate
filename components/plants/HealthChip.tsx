import { HEALTH_LABEL, HEALTH_TONE } from '@/lib/plants/health'
import type { Health } from '@/lib/plants/types'

/** Small pill for a plant's health. The word carries the meaning; colour only backs it up. */
export default function HealthChip({ health }: { health: Health }) {
  return (
    <span className={`health-chip health-chip--${HEALTH_TONE[health]}`}>
      {HEALTH_LABEL[health]}
    </span>
  )
}
