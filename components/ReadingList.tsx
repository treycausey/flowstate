'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { deleteReading, listReadingsByTank, updateReading } from '@/lib/idb'
import { emitReadingsChanged, onReadingsChanged } from '@/lib/events'
import type { Reading } from '@/lib/models'
import { normalizeInput } from '@/lib/validation'
import { formatLocal } from '@/lib/time'

type DraftReading = {
  pH: string
  ammonia: string
  nitrite: string
  nitrate: string
  note: string
}

export default function ReadingList() {
  const { activeTankId } = useTanks()
  const [items, setItems] = useState<Reading[]>([])
  const [editingReading, setEditingReading] = useState<Reading | null>(null)
  const [draft, setDraft] = useState<DraftReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  const modalTitleId = useMemo(
    () => (editingReading ? `edit-${editingReading.id}` : undefined),
    [editingReading],
  )
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!activeTankId) return setItems([])
      const all = await listReadingsByTank(activeTankId)
      if (mounted) setItems(all)
    }
    load()
    const off = onReadingsChanged((tankId) => {
      if (tankId === activeTankId) load()
    })
    return () => {
      mounted = false
      off()
    }
  }, [activeTankId])

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
    if (!confirm('Delete this reading?')) return
    await deleteReading(reading.id)
    setItems((prev) => prev.filter((r) => r.id !== reading.id))
    if (editingReading?.id === reading.id) cancelEditing()
    if (activeTankId) emitReadingsChanged(activeTankId)
  }

  const startEditing = (reading: Reading) => {
    setError(null)
    setDraft({
      pH: String(reading.pH),
      ammonia: String(reading.ammonia),
      nitrite: String(reading.nitrite),
      nitrate: String(reading.nitrate),
      note: reading.note ?? '',
    })
    setEditingReading(reading)
  }

  const cancelEditing = () => {
    setEditingReading(null)
    setDraft(null)
    setError(null)
  }

  const saveEditing = async () => {
    if (!draft || !editingReading) return
    const current = items.find((r) => r.id === editingReading.id)
    if (!current) return

    const metricFields = [draft.pH, draft.ammonia, draft.nitrite, draft.nitrate]
    if (metricFields.some((value) => value.trim() === '')) {
      setError('All metrics must be provided.')
      return
    }

    const pH = Number(draft.pH)
    const ammonia = Number(draft.ammonia)
    const nitrite = Number(draft.nitrite)
    const nitrate = Number(draft.nitrate)

    if ([pH, ammonia, nitrite, nitrate].some((value) => Number.isNaN(value))) {
      setError('All metrics must be valid numbers.')
      return
    }

    const next: Reading = {
      ...current,
      pH: normalizeInput('pH', pH),
      ammonia: normalizeInput('ammonia', ammonia),
      nitrite: normalizeInput('nitrite', nitrite),
      nitrate: normalizeInput('nitrate', nitrate),
      note: draft.note.trim() === '' ? undefined : draft.note.trim(),
    }

    await updateReading(next)
    setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))
    if (activeTankId) emitReadingsChanged(activeTankId)
    cancelEditing()
  }

  if (!activeTankId) return null

  return (
    <div>
      <h3 className="section-title" style={{ marginTop: 0 }}>
        Recent Readings
      </h3>
      {items.length === 0 ? (
        <p>No readings yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th align="left">Time</th>
              <th align="right">pH</th>
              <th align="right">NH3</th>
              <th align="right">NO2</th>
              <th align="right">NO3</th>
              <th align="left">Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{formatLocal(new Date(r.ts))}</td>
                <td align="right">{r.pH}</td>
                <td align="right">{r.ammonia}</td>
                <td align="right">{r.nitrite}</td>
                <td align="right">{r.nitrate}</td>
                <td>{r.note || ''}</td>
                <td>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => startEditing(r)}
                  >
                    Edit
                  </button>{' '}
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => onDelete(r)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editingReading && draft ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault()
                saveEditing()
              }}
            >
              <h4 id={modalTitleId}>Edit Reading</h4>
              <p style={{ marginBottom: 0, color: 'var(--muted)', fontSize: 'var(--step--1)' }}>
                Logged {formatLocal(new Date(editingReading.ts))}
              </p>
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <label>
                  pH
                  <input
                    ref={firstFieldRef}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="5"
                    max="9"
                    value={draft.pH}
                    onChange={(event) => {
                      setError(null)
                      setDraft((prev) => (prev ? { ...prev, pH: event.target.value } : prev))
                    }}
                  />
                </label>
                <label>
                  Ammonia (ppm)
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min="0"
                    max="10"
                    value={draft.ammonia}
                    onChange={(event) => {
                      setError(null)
                      setDraft((prev) => (prev ? { ...prev, ammonia: event.target.value } : prev))
                    }}
                  />
                </label>
                <label>
                  Nitrite (ppm)
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="10"
                    value={draft.nitrite}
                    onChange={(event) => {
                      setError(null)
                      setDraft((prev) => (prev ? { ...prev, nitrite: event.target.value } : prev))
                    }}
                  />
                </label>
                <label>
                  Nitrate (ppm)
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    max="200"
                    value={draft.nitrate}
                    onChange={(event) => {
                      setError(null)
                      setDraft((prev) => (prev ? { ...prev, nitrate: event.target.value } : prev))
                    }}
                  />
                </label>
                <label>
                  Note
                  <input
                    type="text"
                    value={draft.note}
                    onChange={(event) => {
                      setError(null)
                      setDraft((prev) => (prev ? { ...prev, note: event.target.value } : prev))
                    }}
                  />
                </label>
                {error ? (
                  <div role="alert" style={{ color: 'var(--danger)' }}>
                    {error}
                  </div>
                ) : null}
              </div>
              <div className="cluster" style={{ justifyContent: 'flex-end' }}>
                <button className="button" type="submit">
                  Save changes
                </button>
                <button className="button button--ghost" type="button" onClick={cancelEditing}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
