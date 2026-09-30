'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/time'
import CountStepper from './CountStepper'

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export type StockFormValues = {
  name: string
  count: number
  addedAt: Date
  note: string
}

type Props = {
  initial: { name: string; count: number; addedAt?: Date; note?: string }
  submitLabel: string
  saving: boolean
  error: string | null
  onSubmit: (values: StockFormValues) => void
  onCancel: () => void
  /** Optional button on the far left of the action row, e.g. "Delete permanently". */
  extraAction?: ReactNode
  nameHint?: string
  /** Where focus goes when the form appears: the save button (Enter saves) or the name. */
  focusOn?: 'submit' | 'name'
  countLabel?: string
  /** Let a group that is already at 0 keep its count while only the name or note changes. */
  allowZeroCount?: boolean
  /** Hide the date field (a quick add keeps "now"). Shown as a line of text instead. */
  dateLabel?: string
}

/** Name, count, added time and note. Used to add and to edit a group. */
export default function StockForm({
  initial,
  submitLabel,
  saving,
  error,
  onSubmit,
  onCancel,
  extraAction,
  nameHint,
  focusOn,
  countLabel = 'How many',
  allowZeroCount = false,
  dateLabel = 'Added',
}: Props) {
  const id = useId()
  const submitRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (focusOn === 'submit') submitRef.current?.focus()
    else if (focusOn === 'name') document.getElementById(`${id}-name`)?.focus()
  }, [focusOn, id])
  const [name, setName] = useState(initial.name)
  const [count, setCount] = useState(String(initial.count))
  const [when, setWhen] = useState(() => toDatetimeLocalValue(initial.addedAt ?? new Date()))
  const [whenTouched, setWhenTouched] = useState(false)
  const [note, setNote] = useState(initial.note ?? '')
  const [problem, setProblem] = useState<{
    field: 'name' | 'count' | 'when'
    text: string
  } | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!name.trim()) {
      setProblem({ field: 'name', text: 'Give the animals a name.' })
      document.getElementById(`${id}-name`)?.focus()
      return
    }
    const n = Number(count)
    const minCount = allowZeroCount ? 0 : 1
    if (!Number.isInteger(n) || n < minCount) {
      setProblem({
        field: 'count',
        text: allowZeroCount ? 'Enter a count of 0 or more.' : 'Enter a count of 1 or more.',
      })
      document.getElementById(`${id}-count`)?.focus()
      return
    }
    // Untouched keeps the starting time (an edit) or means "now" (an add), so the real current
    // time is used rather than the minute the form opened.
    const parsed = whenTouched ? fromDatetimeLocalValue(when) : (initial.addedAt ?? new Date())
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
    onSubmit({ name: name.trim(), count: n, addedAt: parsed, note: note.trim() })
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
        <label htmlFor={`${id}-count`}>{countLabel}</label>
        <CountStepper
          id={`${id}-count`}
          label={countLabel}
          value={count}
          min={allowZeroCount ? 0 : 1}
          onChange={(v) => {
            setCount(v)
            setProblem(null)
          }}
          invalid={problem?.field === 'count'}
          describedBy={problem?.field === 'count' ? `${id}-count-error` : undefined}
        />
        {problem?.field === 'count' && (
          <span id={`${id}-count-error`} className="field-error">
            {problem.text}
          </span>
        )}
      </div>
      <div className="field field--row">
        <label htmlFor={`${id}-when`}>{dateLabel}</label>
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
