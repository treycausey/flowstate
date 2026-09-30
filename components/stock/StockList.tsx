'use client'

import { RouteLink } from '@/components/plants/ui'
import type { StockEvent, StockGroup } from '@/lib/models'
import { stockSpecies } from '@/lib/stock/catalog'
import { HEALTH_TEXT, HEALTH_TONE, latestHealthByGroup } from '@/lib/stock/feeding'
import { activeGroups, flagsForGroup, type StockFlag } from '@/lib/stock/guidance'
import { ZONE_LABEL } from '@/lib/stock/types'
import { ageText } from '@/lib/plants/format'
import { calendarDaysBetween } from '@/lib/time'
import FlagList from './FlagList'
import StockThumb from './StockThumb'

type Props = {
  groups: StockGroup[]
  events: StockEvent[]
  flags: readonly StockFlag[]
  now: Date
  hrefFor: (group: StockGroup) => string
  onOpen: (group: StockGroup) => void
}

export function HealthChip({ health }: { health: keyof typeof HEALTH_TEXT }) {
  return (
    <span className={`health-chip health-chip--${HEALTH_TONE[health]}`}>{HEALTH_TEXT[health]}</span>
  )
}

/** "6 × Neon tetra" for species groups, "2 × Mystery pleco" for custom ones. */
export function groupTitle(group: StockGroup): string {
  return `${group.count} × ${group.name}`
}

function StockRow({
  group,
  health,
  flags,
  now,
  href,
  onOpen,
}: {
  group: StockGroup
  health: StockEvent | undefined
  flags: StockFlag[]
  now: Date
  href: string
  onOpen: () => void
}) {
  const species = stockSpecies(group.speciesId)
  const removed = !!group.removedAt
  const added = ageText(calendarDaysBetween(new Date(group.addedAt), now))
  const shown = flags.filter((f) => f.level !== 'info')
  return (
    <>
      <RouteLink href={href} onNavigate={onOpen} className="plant-row stock-row">
        <StockThumb speciesId={group.speciesId} kind={species?.kind ?? 'fish'} />
        <span className="plant-row__text">
          <span className="plant-row__name">{groupTitle(group)}</span>
          <span className="plant-row__meta">
            {species ? ZONE_LABEL[species.zone] : 'Custom'}
            {' · '}
            {removed
              ? `Removed ${ageText(calendarDaysBetween(new Date(group.removedAt!), now))}`
              : `added ${added}`}
          </span>
        </span>
        <span className="plant-row__health">
          {health?.health && !removed ? <HealthChip health={health.health} /> : null}
        </span>
      </RouteLink>
      {!removed && shown.length > 0 && <FlagList flags={shown} compact label="Guidance" />}
    </>
  )
}

/** Active groups, then a collapsed list of the ones that left the tank. */
export default function StockList({ groups, events, flags, now, hrefFor, onOpen }: Props) {
  const healthBy = latestHealthByGroup(events)
  const active = activeGroups(groups)
  const gone = groups
    .filter((g) => !active.includes(g))
    .sort((a, b) => (b.removedAt ?? '').localeCompare(a.removedAt ?? ''))
  return (
    <div className="plant-groups">
      {active.length > 0 && (
        <ul className="plant-list stock-list">
          {active.map((g) => (
            <li key={g.id}>
              <StockRow
                group={g}
                health={healthBy.get(g.id)}
                flags={flagsForGroup(flags, g.id)}
                now={now}
                href={hrefFor(g)}
                onOpen={() => onOpen(g)}
              />
            </li>
          ))}
        </ul>
      )}
      {gone.length > 0 && (
        <details className="plant-removed">
          <summary>Left the tank ({gone.length})</summary>
          <ul className="plant-list">
            {gone.map((g) => (
              <li key={g.id}>
                <StockRow
                  group={g}
                  health={undefined}
                  flags={[]}
                  now={now}
                  href={hrefFor(g)}
                  onOpen={() => onOpen(g)}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
