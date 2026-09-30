'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { plantAttentionParts } from '@/lib/plants/format'
import { latestCheckByPlant, tankPlantHealth } from '@/lib/plants/health'
import { usePlants } from '@/lib/plants/usePlants'
import type { Plant, PlantCheck } from '@/lib/models'

/** Presentational line; `now` is injectable for tests. Nothing when the tank has no plants. */
export function PlantsStatusView({
  plants,
  checks,
  now,
}: {
  plants: Plant[]
  checks: PlantCheck[]
  now?: Date
}) {
  const health = useMemo(
    () => tankPlantHealth(plants, latestCheckByPlant(checks), now),
    [plants, checks, now],
  )
  if (health.total === 0) return null
  const attention = plantAttentionParts(health)
  return (
    <p className="plants-line">
      <Link href="/plants">
        <span className="plants-line__label">Plants: {health.total}</span>
        {attention.map((part) => (
          <span key={part} className="plants-line__attention">
            {' · '}
            {part}
          </span>
        ))}
        <span aria-hidden="true" className="plants-line__go">
          {' '}
          →
        </span>
      </Link>
    </p>
  )
}

/** Compact plants summary under the Log screen's tank status, linking to the Plants tab. */
export default function PlantsStatusLine({ tankId }: { tankId: string | null }) {
  const { plants, checks } = usePlants(tankId)
  if (!plants || !checks) return null
  return <PlantsStatusView plants={plants} checks={checks} />
}
