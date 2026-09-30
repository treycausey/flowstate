'use client'

import { useRef, useState } from 'react'
import { updateStock } from '@/lib/idb'
import { emitStockChanged } from '@/lib/events'
import type { StockEvent, StockGroup } from '@/lib/models'
import { ageText } from '@/lib/plants/format'
import { stockSpecies } from '@/lib/stock/catalog'
import { eventsForGroup } from '@/lib/stock/feeding'
import { flagsForGroup, type StockFlag } from '@/lib/stock/guidance'
import { ZONE_LABEL } from '@/lib/stock/types'
import { calendarDaysBetween, formatLocal } from '@/lib/time'
import EditStockModal from './EditStockModal'
import EventModal, { type EventAction } from './EventModal'
import FlagList from './FlagList'
import { HealthChip, groupTitle } from './StockList'
import StockCare from './StockCare'
import StockThumb from './StockThumb'

const shortDate = { month: 'short', day: 'numeric' } as const
const fullDate = { dateStyle: 'medium' } as const

/** One line describing what an event did. */
export function eventText(e: StockEvent): string {
  const n = Math.abs(e.countDelta ?? 0)
  switch (e.kind) {
    case 'lost':
      return `Lost ${n}`
    case 'rehomed':
      return `Rehomed ${n}`
    case 'added':
      return `${n} joined the group`
    case 'health':
      return 'Health check'
    case 'observed':
      return 'Observation'
    case 'fed':
      return 'Fed'
  }
}

type Props = {
  group: StockGroup
  /** Every event of the tank; this component picks the ones for its group. */
  events: StockEvent[]
  flags: readonly StockFlag[]
  now: Date
  /** Leave the detail (after a permanent delete). */
  onLeave: () => void
}

/** One group: state, actions, guidance, history and the care card. */
export default function GroupDetail({ group, events, flags, now, onLeave }: Props) {
  const species = stockSpecies(group.speciesId)
  const removed = !!group.removedAt
  const history = eventsForGroup(events, group.id)
  const latestHealth = history.find((e) => e.health)
  const [action, setAction] = useState<EventAction | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mine = flagsForGroup(flags, group.id)

  const setRemoved = async (removedAt: string | null) => {
    setError(null)
    try {
      await updateStock({ ...group, removedAt })
    } catch (err) {
      console.error('Failed to update stock', err)
      setError(`Couldn’t update: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    emitStockChanged(group.tankId)
    // The button that was pressed is about to change; keep keyboard focus on the page.
    headingRef.current?.focus()
  }

  return (
    <div className="stack plant-detail">
      <div className="plant-hero">
        <StockThumb speciesId={group.speciesId} kind={species?.kind ?? 'fish'} size="lg" />
        <div className="plant-hero__text">
          <h2 ref={headingRef} tabIndex={-1} id="stock-heading" className="plant-hero__name">
            {groupTitle(group)}
          </h2>
          <p className="plant-hero__sci">{species ? species.scientific : 'Custom animal'}</p>
          <p className="plant-hero__meta muted">
            {species ? `${ZONE_LABEL[species.zone]} · ` : ''}added{' '}
            <time
              dateTime={group.addedAt}
              title={formatLocal(new Date(group.addedAt), undefined, fullDate)}
            >
              {ageText(calendarDaysBetween(new Date(group.addedAt), now))}
            </time>
          </p>
        </div>
      </div>

      {removed ? (
        <div className="notice plant-removed-note">
          <p style={{ margin: 0 }}>
            {group.count === 0 ? 'None left' : 'Removed'}{' '}
            {formatLocal(new Date(group.removedAt!), undefined, fullDate)} (
            {ageText(calendarDaysBetween(new Date(group.removedAt!), now))}). It stays in your
            history and is hidden from the tank.
          </p>
        </div>
      ) : (
        <p className="plant-state">
          {latestHealth?.health ? (
            <HealthChip health={latestHealth.health} />
          ) : (
            <span className="muted">No health notes yet</span>
          )}
        </p>
      )}

      <div className="cluster plant-detail__actions">
        {!removed && (
          <button type="button" className="button" onClick={() => setAction('observe')}>
            Observe
          </button>
        )}
        {!removed && (
          <>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setAction('lost')}
            >
              Lost
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setAction('rehomed')}
            >
              Rehome
            </button>
          </>
        )}
        <button type="button" className="button button--ghost" onClick={() => setAction('added')}>
          Added more
        </button>
        <button type="button" className="button button--ghost" onClick={() => setEditing(true)}>
          Edit
        </button>
        {removed && group.count > 0 && (
          <button type="button" className="button" onClick={() => setRemoved(null)}>
            Restore to tank
          </button>
        )}
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

      {!removed && mine.length > 0 && <FlagList flags={mine} label="Guidance for this group" />}

      {group.note && <p className="plant-note">{group.note}</p>}

      <section aria-labelledby="stock-history-title">
        <h3 id="stock-history-title" className="section-title">
          History
        </h3>
        {history.length === 0 ? (
          <p className="muted">Nothing yet. Observe, or record a loss or a new arrival.</p>
        ) : (
          <ol className="timeline" aria-label="Events, newest first">
            {history.map((e) => (
              <li key={e.id}>
                <div className="timeline__head">
                  <span>
                    <time dateTime={e.ts}>{formatLocal(new Date(e.ts), undefined, shortDate)}</time>
                    {' · '}
                    <span>{eventText(e)}</span>
                  </span>
                  {e.health && <HealthChip health={e.health} />}
                </div>
                {e.note && <p className="timeline__note muted">{e.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {species ? (
        <section aria-labelledby="stock-care-title">
          <h3 id="stock-care-title" className="section-title">
            Care for {species.name}
          </h3>
          <StockCare species={species} />
        </section>
      ) : (
        <p className="muted">
          This is a custom animal, so there is no built-in care guide. You can still log events.
        </p>
      )}

      {action && (
        <EventModal
          key={action}
          group={group}
          action={action}
          onClose={() => setAction(null)}
          onSaved={() => setAction(null)}
        />
      )}
      {editing && (
        <EditStockModal
          group={group}
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
