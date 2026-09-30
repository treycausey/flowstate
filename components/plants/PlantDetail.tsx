'use client'

import { useRef, useState } from 'react'
import { updatePlant } from '@/lib/idb'
import { emitPlantsChanged } from '@/lib/events'
import type { Plant, PlantCheck } from '@/lib/models'
import { getSpecies } from '@/lib/plants/catalog'
import { ageText } from '@/lib/plants/format'
import {
  SYMPTOMS,
  daysSincePlanted,
  diagnose,
  isCheckDue,
  type Diagnosis,
  type LatestReadings,
} from '@/lib/plants/health'
import { PLACEMENT_LABEL } from '@/lib/plants/types'
import { calendarDaysBetween, compareTs, formatLocal } from '@/lib/time'
import CareCard from './CareCard'
import CheckHealthModal from './CheckHealthModal'
import DiagnosisCard from './DiagnosisCard'
import EditPlantModal from './EditPlantModal'
import HealthChip from './HealthChip'
import PlantThumb from './PlantThumb'

const ACTION_TEXT = {
  trimmed: 'Trimmed',
  replanted: 'Replanted',
  moved: 'Moved',
  fed: 'Fed the plant',
  cleaned: 'Cleaned leaves',
  none: 'Did nothing',
} as const
const shortDate = { month: 'short', day: 'numeric' } as const
const fullDate = { dateStyle: 'medium' } as const

type Props = {
  plant: Plant
  /** Every check of this plant. */
  checks: PlantCheck[]
  latestReadings: LatestReadings
  now: Date
  /** Leave the detail (after a permanent delete). */
  onLeave: () => void
}

/** One plant: state, actions, care card and health history. */
export default function PlantDetail({ plant, checks, latestReadings, now, onLeave }: Props) {
  const species = getSpecies(plant.speciesId)
  const removed = !!plant.removedAt
  const history = checks.slice().sort(compareTs).reverse()
  const latest = history[0]
  const due = isCheckDue(plant, latest, now)
  const [checking, setChecking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [diagnoses, setDiagnoses] = useState<Diagnosis[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const setRemoved = async (removedAt: string | null) => {
    setError(null)
    try {
      await updatePlant({ ...plant, removedAt })
    } catch (err) {
      console.error('Failed to update plant', err)
      setError(`Couldn’t update: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    emitPlantsChanged(plant.tankId)
    // The button that was pressed is about to change; keep keyboard focus on the page.
    headingRef.current?.focus()
  }

  const onChecked = (check: PlantCheck) => {
    setChecking(false)
    if (check.symptoms.length === 0) {
      setDiagnoses(null)
      return
    }
    setDiagnoses(
      diagnose({
        symptoms: check.symptoms,
        species,
        placement: plant.placement,
        latestReadings,
        daysSincePlanted: daysSincePlanted(plant, new Date()),
      }),
    )
  }

  return (
    <div className="stack plant-detail">
      <div className="plant-hero">
        <PlantThumb speciesId={plant.speciesId} placement={plant.placement} size="lg" />
        <div className="plant-hero__text">
          <h2 ref={headingRef} tabIndex={-1} id="plants-heading" className="plant-hero__name">
            {plant.name}
          </h2>
          <p className="plant-hero__sci">{species ? species.scientific : 'Custom plant'}</p>
          <p className="plant-hero__meta muted">
            {PLACEMENT_LABEL[plant.placement]} · planted{' '}
            <time
              dateTime={plant.plantedAt}
              title={formatLocal(new Date(plant.plantedAt), undefined, fullDate)}
            >
              {ageText(daysSincePlanted(plant, now))}
            </time>
          </p>
        </div>
      </div>

      {removed ? (
        <div className="notice plant-removed-note">
          <p style={{ margin: 0 }}>
            Removed {formatLocal(new Date(plant.removedAt!), undefined, fullDate)} (
            {ageText(calendarDaysBetween(new Date(plant.removedAt!), now))}). It stays in your
            history and is hidden from the tank.
          </p>
        </div>
      ) : (
        <p className="plant-state">
          {latest ? (
            <HealthChip health={latest.health} />
          ) : (
            <span className="muted">Not checked yet</span>
          )}
          {due && <span className="plant-row__due">Check due</span>}
        </p>
      )}

      <div className="cluster plant-detail__actions">
        {removed ? (
          <button type="button" className="button" onClick={() => setRemoved(null)}>
            Restore to tank
          </button>
        ) : (
          <button type="button" className="button" onClick={() => setChecking(true)}>
            Check health
          </button>
        )}
        <button type="button" className="button button--ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
        {!removed && (
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setRemoved(new Date().toISOString())}
          >
            Remove from tank
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="danger">
          {error}
        </div>
      )}

      {diagnoses && !removed && (
        <DiagnosisCard
          plantName={plant.name}
          diagnoses={diagnoses}
          onDismiss={() => setDiagnoses(null)}
        />
      )}

      {plant.note && <p className="plant-note">{plant.note}</p>}

      <section aria-labelledby="history-title">
        <h3 id="history-title" className="section-title">
          Health history
        </h3>
        {history.length === 0 ? (
          <p className="muted">
            No checks yet. {removed ? '' : 'Use Check health to start a history.'}
          </p>
        ) : (
          <ol className="timeline" aria-label="Checks, newest first">
            {history.map((c) => (
              <li key={c.id}>
                <div className="timeline__head">
                  <time dateTime={c.ts}>{formatLocal(new Date(c.ts), undefined, shortDate)}</time>
                  <HealthChip health={c.health} />
                </div>
                {(c.symptoms.length > 0 || c.action) && (
                  <p className="timeline__detail">
                    {[
                      ...c.symptoms.map((s) => SYMPTOMS[s].label),
                      ...(c.action && c.action !== 'none' ? [ACTION_TEXT[c.action]] : []),
                    ].join(' · ')}
                    {c.action === 'none' && c.symptoms.length === 0 ? ACTION_TEXT.none : ''}
                  </p>
                )}
                {c.note && <p className="timeline__note muted">{c.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {species ? (
        <section aria-labelledby="care-title">
          <h3 id="care-title" className="section-title">
            Care for {species.name}
          </h3>
          <CareCard species={species} />
        </section>
      ) : (
        <p className="muted">
          This is a custom plant, so there is no built-in care guide. You can still log checks.
        </p>
      )}

      {checking && (
        <CheckHealthModal plant={plant} onClose={() => setChecking(false)} onSaved={onChecked} />
      )}
      {editing && (
        <EditPlantModal
          plant={plant}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onDeleted={() => {
            setEditing(false)
            onLeave()
          }}
        />
      )}
    </div>
  )
}
