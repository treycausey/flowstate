'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import type { StockEvent, StockGroup } from '@/lib/models'
import { animalCount } from '@/lib/stock/guidance'
import { fedToday } from '@/lib/stock/feeding'
import { countText } from '@/lib/stock/format'
import { useNow } from '@/lib/stock/useNow'
import { useStock } from '@/lib/stock/useStock'

/** Presentational line; `now` is injectable for tests. Nothing when the tank has no animals. */
export function StockStatusView({
  groups,
  events,
  now,
}: {
  groups: StockGroup[]
  events: StockEvent[]
  now?: Date
}) {
  const animals = useMemo(() => animalCount(groups), [groups])
  const fed = fedToday(events, now ?? new Date())
  if (animals === 0) return null
  return (
    <p className="plants-line">
      <Link href="/stock">
        <span className="plants-line__label">Stock: {countText(animals, 'animal')}</span>
        <span className={fed ? 'plants-line__fed' : 'plants-line__attention'}>
          {' · '}
          {fed ? 'fed today' : 'not fed today'}
        </span>
        <span aria-hidden="true" className="plants-line__go">
          {' '}
          →
        </span>
      </Link>
    </p>
  )
}

/** Compact stock summary under the Log screen's tank status, linking to the Stock tab. */
export default function StockStatusLine({ tankId }: { tankId: string | null }) {
  const { groups, events, failed } = useStock(tankId)
  const now = useNow()
  if (failed) {
    return (
      <p role="alert" className="danger">
        Couldn&apos;t load stock.
      </p>
    )
  }
  if (!groups || !events) return null
  return <StockStatusView groups={groups} events={events} now={now} />
}
