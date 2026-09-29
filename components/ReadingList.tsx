'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTanks } from '@/components/TankProvider'
import { deleteReading, listReadingsWithinHour, updateReading } from '@/lib/idb'
import { emitReadingsChanged } from '@/lib/events'
import { useTankReadings } from '@/lib/useTankReadings'
import { METRICS, METRIC_SHORT, type Metric, type Reading } from '@/lib/models'
import { parseReadingInputs, stepMetricText } from '@/lib/validation'
import { formatLocal, fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/time'
import { formatMetric } from '@/lib/format'
import { severity } from '@/lib/series'
import KitChips from '@/components/KitChips'

type DraftReading = Record<Metric, string> & { ts: string; note: string }

const EDIT_LABEL: Record<Metric, string> = {
  pH: 'pH',
  ammonia: 'Ammonia (ppm)',
  nitrite: 'Nitrite (ppm)',
  nitrate: 'Nitrate (ppm)',
}

const SEVERITY_TEXT = { caution: 'caution', high: 'out of range' } as const

function MetricCell({ metric, value }: { metric: Metric; value: number | null }) {
  if (value === null)
    return (
      <td className="num muted">
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">not tested</span>
      </td>
    )
  const level = severity(metric, value)
  if (level === 'ok') return <td className="num">{formatMetric(metric, value)}</td>
  return (
    <td className={`num flag flag--${level}`}>
      {formatMetric(metric, value)}
      <span aria-hidden="true">{level === 'high' ? ' ▲' : ' △'}</span>
      <span className="visually-hidden"> ({SEVERITY_TEXT[level]})</span>
    </td>
  )
}

export default function ReadingList({ limit = 10 }: { limit?: number }) {
  const { activeTankId } = useTanks()
  const { readings, failed } = useTankReadings(activeTankId)
  const items = useMemo(() => (readings ?? []).slice().reverse(), [readings]) // newest first
  const [showAllFor, setShowAllFor] = useState<string | null>(null)
  const showAll = showAllFor !== null && showAllFor === activeTankId
  const [editingReading, setEditingReading] = useState<Reading | null>(null)
  const [draft, setDraft] = useState<DraftReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const cancelEditing = () => {
    setEditingReading(null)
    setDraft(null)
    setError(null)
  }

  useEffect(() => {
    if (!editingReading) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancelEditing()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingReading])

  useEffect(() => {
    if (editingReading && firstFieldRef.current) {
      firstFieldRef.current.focus()
      firstFieldRef.current.select()
    }
  }, [editingReading])

  const onDelete = async (reading: Reading) => {
    if (!window.confirm(`Delete the reading from ${formatLocal(new Date(reading.ts))}?`)) return
    try {
      await deleteReading(reading.id)
    } catch (err) {
      console.error('Failed to delete reading', err)
      setError(`Couldn’t delete: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    if (editingReading?.id === reading.id) cancelEditing()
    emitReadingsChanged(reading.tankId)
  }

  const startEditing = (reading: Reading) => {
    setError(null)
    setDraft({
      ts: toDatetimeLocalValue(new Date(reading.ts)),
      pH: reading.pH === null ? '' : String(reading.pH),
      ammonia: reading.ammonia === null ? '' : String(reading.ammonia),
      nitrite: reading.nitrite === null ? '' : String(reading.nitrite),
      nitrate: reading.nitrate === null ? '' : String(reading.nitrate),
      note: reading.note ?? '',
    })
    setEditingReading(reading)
  }

  const saveEditing = async () => {
    if (!draft || !editingReading) return
    const parsed = parseReadingInputs({
      pH: draft.pH,
      ammonia: draft.ammonia,
      nitrite: draft.nitrite,
      nitrate: draft.nitrate,
    })
    if (!parsed.ok) {
      const bad = METRICS.find((m) => parsed.errors[m])
      setError(bad ? `${EDIT_LABEL[bad]}: ${parsed.errors[bad]}` : (parsed.formError ?? 'Invalid'))
      return
    }
    const values = parsed.values
    const when = fromDatetimeLocalValue(draft.ts)
    if (!when) {
      setError('Enter a valid date and time.')
      return
    }

    const note = draft.note.trim()
    const next: Reading = {
      ...editingReading,
      ...values,
      ts: when.toISOString(),
      note: note === '' ? undefined : note,
    }

    try {
      if (new Date(editingReading.ts).getTime() !== when.getTime()) {
        const near = await listReadingsWithinHour(next.tankId, next.ts, next.id)
        if (
          near.length > 0 &&
          !window.confirm('Another reading is within an hour of this time. Save anyway?')
        )
          return
      }
      await updateReading(next)
    } catch (err) {
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    emitReadingsChanged(next.tankId)
    cancelEditing()
  }

  const setDraftField = (field: keyof DraftReading, value: string) => {
    setError(null)
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  if (!activeTankId) return null

  const visible = showAll ? items : items.slice(0, limit)

  return (
    <div>
      <h2 className="section-title">Recent readings</h2>
      {failed ? (
        <p className="danger" role="alert">
          Couldn&apos;t load readings.
        </p>
      ) : readings === null ? null : items.length === 0 ? (
        <p className="muted">No readings yet. Log your first test above.</p>
      ) : (
        <div className="table-scroll">
          <table className="readings">
            <thead>
              <tr>
                <th scope="col" className="left">
                  Time
                </th>
                {METRICS.map((m) => (
                  <th key={m} scope="col" className="num">
                    {METRIC_SHORT[m]}
                  </th>
                ))}
                <th scope="col" className="left note-col">
                  Note
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="left nowrap">
                    <time dateTime={r.ts}>
                      {formatLocal(new Date(r.ts), undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </time>
                  </td>
                  {METRICS.map((m) => (
                    <MetricCell key={m} metric={m} value={r[m]} />
                  ))}
                  <td className="left note-col">{r.note || ''}</td>
                  <td className="actions">
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => startEditing(r)}
                      aria-label={`Edit reading from ${formatLocal(new Date(r.ts))}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!failed && items.length > limit && (
        <button
          type="button"
          className="button button--ghost"
          style={{ marginTop: 'var(--space-3)' }}
          onClick={() => setShowAllFor(showAll ? null : activeTankId)}
        >
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
      {editingReading && draft
        ? // Portal: the frosted panel's backdrop-filter would otherwise trap position: fixed
          createPortal(
            <div className="modal-overlay" role="presentation">
              <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`edit-${editingReading.id}`}
              >
                <form
                  className="stack"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveEditing()
                  }}
                >
                  <h3 id={`edit-${editingReading.id}`} style={{ margin: 0 }}>
                    Edit Reading
                  </h3>
                  <div className="stack" style={{ gap: 'var(--space-3)' }}>
                    <label>
                      Date &amp; time
                      <input
                        type="datetime-local"
                        value={draft.ts}
                        onChange={(e) => setDraftField('ts', e.target.value)}
                      />
                    </label>
                    <div className="metric-grid">
                      {METRICS.map((m, i) => (
                        <div className="field" key={m}>
                          <label htmlFor={`edit-${m}`}>{EDIT_LABEL[m]}</label>
                          <KitChips
                            metric={m}
                            value={draft[m]}
                            onChange={(next) => setDraftField(m, next)}
                          >
                            <input
                              id={`edit-${m}`}
                              ref={i === 0 ? firstFieldRef : undefined}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={draft[m]}
                              onChange={(e) => setDraftField(m, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                                if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return
                                e.preventDefault()
                                setDraftField(
                                  m,
                                  stepMetricText(m, draft[m], e.key === 'ArrowUp' ? 1 : -1),
                                )
                              }}
                            />
                          </KitChips>
                        </div>
                      ))}
                    </div>
                    <label>
                      Note
                      <input
                        type="text"
                        maxLength={200}
                        value={draft.note}
                        onChange={(e) => setDraftField('note', e.target.value)}
                      />
                    </label>
                    {error ? (
                      <div role="alert" className="danger">
                        {error}
                      </div>
                    ) : null}
                  </div>
                  <div className="cluster" style={{ justifyContent: 'flex-end' }}>
                    <button
                      className="button button--ghost button--danger"
                      type="button"
                      style={{ marginRight: 'auto' }}
                      onClick={() => onDelete(editingReading)}
                    >
                      Delete
                    </button>
                    <button className="button button--ghost" type="button" onClick={cancelEditing}>
                      Cancel
                    </button>
                    <button className="button" type="submit">
                      Save changes
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
