'use client'

import { useId, useState } from 'react'
import Modal from '@/components/plants/Modal'
import { ToggleChip } from '@/components/plants/ui'
import { addStockEvent } from '@/lib/idb'
import { emitStockChanged } from '@/lib/events'
import type { StockEvent, StockGroup, StockHealth } from '@/lib/models'
import { HEALTH_TEXT } from '@/lib/stock/feeding'
import CountStepper from './CountStepper'

export type EventAction = 'observe' | 'lost' | 'rehomed' | 'added'

const TITLE: Record<EventAction, string> = {
  observe: 'Observe',
  lost: 'Lost animals',
  rehomed: 'Rehomed animals',
  added: 'Added more',
}

const SUBMIT: Record<EventAction, string> = {
  observe: 'Save observation',
  lost: 'Record loss',
  rehomed: 'Record rehoming',
  added: 'Add to group',
}

const HEALTH_CHOICES: StockHealth[] = ['ok', 'concern', 'sick']

type Props = {
  group: StockGroup
  action: EventAction
  onClose: () => void
  onSaved: (event: StockEvent) => void
}

/** One small dialog for every group action: observe (health and note), lost, rehomed, added. */
export default function EventModal({ group, action, onClose, onSaved }: Props) {
  const id = useId()
  const counting = action !== 'observe'
  const [count, setCount] = useState('1')
  const [health, setHealth] = useState<StockHealth | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const trimmed = note.trim()
    const n = Number(count)
    if (counting && (!Number.isInteger(n) || n < 1)) {
      setProblem('Enter a count of 1 or more.')
      document.getElementById(`${id}-count`)?.focus()
      return
    }
    if (!counting && !health && !trimmed) {
      setProblem('Pick how they look, or write a note.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const event = await addStockEvent({
        tankId: group.tankId,
        stockId: group.id,
        ts: new Date().toISOString(),
        kind: counting ? action : health ? 'health' : 'observed',
        ...(counting ? { countDelta: n } : {}),
        ...(health ? { health } : {}),
        ...(trimmed ? { note: trimmed } : {}),
      })
      emitStockChanged(group.tankId)
      onSaved(event)
    } catch (err) {
      console.error('Failed to save stock event', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  const maxNote = action === 'lost' || action === 'rehomed' ? Math.max(group.count, 1) : 999

  return (
    <Modal labelledBy={`${id}-title`} onClose={onClose} initialFocus="input, button.choice-chip">
      <div className="stack">
        <div className="cluster plant-modal__head">
          <h3 id={`${id}-title`} style={{ margin: 0 }}>
            {TITLE[action]}: {group.name}
          </h3>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <form className="stack plant-form" onSubmit={submit} noValidate>
          {counting ? (
            <div className="field">
              <label htmlFor={`${id}-count`}>
                {action === 'added' ? 'How many joined' : 'How many'}
              </label>
              <CountStepper
                id={`${id}-count`}
                label="animals"
                value={count}
                max={maxNote}
                onChange={(v) => {
                  setCount(v)
                  setProblem(null)
                }}
                invalid={!!problem}
                describedBy={problem ? `${id}-problem` : undefined}
              />
              {action !== 'added' && (
                <span className="field-note muted">
                  {group.count} in the group now. It leaves the tank list when none are left.
                </span>
              )}
            </div>
          ) : (
            <div className="field">
              <span className="field-label" id={`${id}-health`}>
                How do they look?
              </span>
              <div className="chips" role="group" aria-labelledby={`${id}-health`}>
                {HEALTH_CHOICES.map((h) => (
                  <ToggleChip
                    key={h}
                    pressed={health === h}
                    onClick={() => {
                      setHealth(health === h ? null : h)
                      setProblem(null)
                    }}
                  >
                    {HEALTH_TEXT[h]}
                  </ToggleChip>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor={`${id}-note`}>Note</label>
            <input
              id={`${id}-note`}
              type="text"
              value={note}
              maxLength={200}
              autoComplete="off"
              placeholder={
                action === 'observe'
                  ? 'Eating well, clamped fins, hiding…'
                  : action === 'lost'
                    ? 'What happened, if you know'
                    : undefined
              }
              onChange={(e) => {
                setNote(e.target.value)
                setProblem(null)
              }}
            />
          </div>
          {problem && (
            <span id={`${id}-problem`} className="field-error" role="alert">
              {problem}
            </span>
          )}
          {error && (
            <div role="alert" className="danger">
              {error}
            </div>
          )}
          <div className="cluster plant-actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={saving}>
              {saving ? 'Saving…' : SUBMIT[action]}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
