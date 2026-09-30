'use client'

import { useId } from 'react'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  invalid?: boolean
  describedBy?: string
  id?: string
}

/** Whole-number field with big minus and plus buttons. The text stays editable for typing. */
export default function CountStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 999,
  invalid,
  describedBy,
  id: idProp,
}: Props) {
  const auto = useId()
  const id = idProp ?? auto
  const n = Number(value)
  const current = Number.isInteger(n) ? n : min
  const set = (next: number) => onChange(String(Math.min(max, Math.max(min, next))))
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        aria-label={`Fewer ${label.toLowerCase()}`}
        disabled={current <= min}
        onClick={() => set(current - 1)}
      >
        −
      </button>
      <input
        id={id}
        className="stepper__input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            set(current + 1)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            set(current - 1)
          }
        }}
      />
      <button
        type="button"
        className="stepper__btn"
        aria-label={`More ${label.toLowerCase()}`}
        disabled={current >= max}
        onClick={() => set(current + 1)}
      >
        +
      </button>
    </div>
  )
}
