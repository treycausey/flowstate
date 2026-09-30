'use client'

import type { Plant, PlantCheck } from '@/lib/models'
import { getSpecies } from '@/lib/plants/catalog'
import { ageText } from '@/lib/plants/format'
import {
  daysSincePlanted,
  isActivePlant,
  isCheckDue,
  latestCheckByPlant,
} from '@/lib/plants/health'
import { PLACEMENT_LABEL, type Placement } from '@/lib/plants/types'
import { calendarDaysBetween } from '@/lib/time'
import HealthChip from './HealthChip'
import PlantThumb from './PlantThumb'
import { RouteLink } from './ui'

const GROUP_ORDER: Placement[] = ['foreground', 'midground', 'background', 'floating', 'epiphyte']

type Props = {
  plants: Plant[]
  checks: PlantCheck[]
  now: Date
  hrefFor: (plant: Plant) => string
  onOpen: (plant: Plant) => void
}

function PlantRow({
  plant,
  latest,
  now,
  href,
  onOpen,
}: {
  plant: Plant
  latest: PlantCheck | undefined
  now: Date
  href: string
  onOpen: () => void
}) {
  const species = getSpecies(plant.speciesId)
  const removed = !!plant.removedAt
  const due = isCheckDue(plant, latest, now)
  const planted = ageText(daysSincePlanted(plant, now))
  return (
    <RouteLink href={href} onNavigate={onOpen} className="plant-row">
      <PlantThumb speciesId={plant.speciesId} placement={plant.placement} />
      <span className="plant-row__text">
        <span className="plant-row__name">{plant.name}</span>
        {(!species || species.scientific !== plant.name) && (
          <span className="plant-row__sci">{species ? species.scientific : 'Custom plant'}</span>
        )}
        <span className="plant-row__meta">
          {removed
            ? `Removed ${ageText(calendarDaysBetween(new Date(plant.removedAt!), now))}`
            : `Planted ${planted}`}
          {due && (
            <>
              {' · '}
              <span className="plant-row__due">Check due</span>
            </>
          )}
        </span>
      </span>
      <span className="plant-row__health">
        {latest && !removed ? (
          <HealthChip health={latest.health} />
        ) : (
          !removed && <span className="muted plant-row__unchecked">Not checked</span>
        )}
      </span>
    </RouteLink>
  )
}

/** Active plants grouped by placement, then a collapsed list of removed ones. */
export default function PlantList({ plants, checks, now, hrefFor, onOpen }: Props) {
  const latest = latestCheckByPlant(checks)
  const active = plants.filter(isActivePlant)
  const removed = plants
    .filter((p) => !isActivePlant(p))
    .sort((a, b) => (b.removedAt ?? '').localeCompare(a.removedAt ?? ''))

  return (
    <div className="plant-groups">
      {GROUP_ORDER.map((placement) => {
        const group = active.filter((p) => p.placement === placement)
        if (group.length === 0) return null
        return (
          <section key={placement} aria-labelledby={`group-${placement}`} className="plant-group">
            <h3 id={`group-${placement}`} className="plant-group__title">
              {PLACEMENT_LABEL[placement]} <span className="muted">{group.length}</span>
            </h3>
            <ul className="plant-list">
              {group.map((p) => (
                <li key={p.id}>
                  <PlantRow
                    plant={p}
                    latest={latest.get(p.id)}
                    now={now}
                    href={hrefFor(p)}
                    onOpen={() => onOpen(p)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {removed.length > 0 && (
        <details className="plant-removed">
          <summary>Removed ({removed.length})</summary>
          <ul className="plant-list">
            {removed.map((p) => (
              <li key={p.id}>
                <PlantRow
                  plant={p}
                  latest={latest.get(p.id)}
                  now={now}
                  href={hrefFor(p)}
                  onOpen={() => onOpen(p)}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
