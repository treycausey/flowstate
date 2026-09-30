'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/time'
import { PLACEMENTS, PLACEMENT_LABEL, type Placement } from '@/lib/plants/types'
import { ToggleChip } from './ui'

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export type PlantFormValues = {
  name: string
  placement: Placement
  plantedAt: Date
  note: string
}

type Props = {
  initial: { name: string; placement: Placement; plantedAt?: Date; note?: string }
  submitLabel: string
  saving: boolean
  error: string | null
  onSubmit: (values: PlantFormValues) => void
  onCancel: () => void
  /** Optional button on the far left of the action row, e.g. "Delete permanently". */
  extraAction?: ReactNode
  nameHint?: string
  /** Where focus goes when the form appears: the save button (Enter saves) or the name. */
  focusOn?: 'submit' | 'name'
}

/** Name, placement, planted time and note. Used to add and to edit a plant. */
export default function PlantForm({
  initial,
  submitLabel,
  saving,
  error,
  onSubmit,
  onCancel,
  extraAction,
  nameHint,
  focusOn,
}: Props) {
  const id = useId()
  const submitRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusOn === 'submit') submitRef.current?.focus()
    else if (focusOn === 'name') document.getElementById(`${id}-name`)?.focus()
  }, [focusOn, id])
  const [name, setName] = useState(initial.name)
  const [placement, setPlacement] = useState<Placement>(initial.placement)
  const [when, setWhen] = useState(() => toDatetimeLocalValue(initial.plantedAt ?? new Date()))
  const [whenTouched, setWhenTouched] = useState(false)
  const [note, setNote] = useState(initial.note ?? '')
  const [problem, setProblem] = useState<{ field: 'name' | 'when'; text: string } | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) {
      setProblem({ field: 'name', text: 'Give the plant a name.' })
      document.getElementById(`${id}-name`)?.focus()
      return
    }
    // Untouched keeps the starting time (an edit) or means "planted now" (an add), so the real
    // current time is used rather than the minute the form opened.
    const parsed = whenTouched ? fromDatetimeLocalValue(when) : (initial.plantedAt ?? new Date())
    if (!parsed) {
      setProblem({ field: 'when', text: 'Enter a valid date and time.' })
      document.getElementById(`${id}-when`)?.focus()
      return
    }
    if (parsed.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      setProblem({ field: 'when', text: 'Can’t be in the future.' })
      document.getElementById(`${id}-when`)?.focus()
      return
    }
    onSubmit({ name: name.trim(), placement, plantedAt: parsed, note: note.trim() })
  }

  return (
    <form className="stack plant-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name</label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          maxLength={80}
          autoComplete="off"
          aria-invalid={problem?.field === 'name'}
          aria-describedby={problem?.field === 'name' ? `${id}-name-error` : undefined}
          onChange={(e) => {
            setName(e.target.value)
            setProblem(null)
          }}
        />
        {problem?.field === 'name' ? (
          <span id={`${id}-name-error`} className="field-error">
            {problem.text}
          </span>
        ) : (
          nameHint && <span className="field-note muted">{nameHint}</span>
        )}
      </div>
      <div className="field">
        <span className="field-label" id={`${id}-placement`}>
          Placement
        </span>
        <div className="chips" role="group" aria-labelledby={`${id}-placement`}>
          {PLACEMENTS.map((p) => (
            <ToggleChip key={p} pressed={placement === p} onClick={() => setPlacement(p)}>
              {PLACEMENT_LABEL[p]}
            </ToggleChip>
          ))}
        </div>
      </div>
      <div className="field field--row">
        <label htmlFor={`${id}-when`}>Planted</label>
        <input
          id={`${id}-when`}
          type="datetime-local"
          value={when}
          aria-invalid={problem?.field === 'when'}
          aria-describedby={problem?.field === 'when' ? `${id}-when-error` : undefined}
          onChange={(e) => {
            setWhen(e.target.value)
            setWhenTouched(true)
            setProblem(null)
          }}
        />
        {problem?.field === 'when' && (
          <span id={`${id}-when-error`} className="field-error">
            {problem.text}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${id}-note`}>Note</label>
        <input
          id={`${id}-note`}
          type="text"
          value={note}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && (
        <div role="alert" className="danger">
          {error}
        </div>
      )}
      <div className="cluster plant-actions">
        {extraAction}
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button ref={submitRef} type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
