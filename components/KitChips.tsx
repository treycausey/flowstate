'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { METRIC_SHORT, type Metric } from '@/lib/models'
import { KIT_PH_HIGH_RANGE, KIT_VALUES, formatKitValue, isKitValueSelected } from '@/lib/kit'

const GROUP_NAME: Record<Metric, string> = {
  pH: 'pH',
  ammonia: 'Ammonia',
  nitrite: 'Nitrite',
  nitrate: 'Nitrate',
}

type Props = {
  metric: Metric
  /** The field's raw text. */
  value: string
  /** Called with the chip's value as text, or '' when the selected chip is tapped again. */
  onChange: (next: string) => void
  disabled?: boolean
  /** The metric's text input. Rendered after the pH range toggle so DOM order matches visual order. */
  children?: ReactNode
}

/**
 * Tappable colour-card values under a metric input. Tapping a chip sets the field;
 * tapping the selected chip clears it (not tested). pH shows one kit row at a time,
 * with a toggle for the high-range kit, to keep the form short on a phone.
 */
export default function KitChips({ metric, value, onChange, disabled, children }: Props) {
  const [highChosen, setHighChosen] = useState<boolean | null>(null)
  // Until the user picks, follow the field: a high-range value shows the high-range row.
  const fieldIsHigh = KIT_PH_HIGH_RANGE.some((v) => isKitValueSelected(value, v))
  const high = metric === 'pH' && (highChosen ?? fieldIsHigh)
  const values = high ? KIT_PH_HIGH_RANGE : KIT_VALUES[metric]

  // Roving tabindex: the row is one Tab stop (the last-focused chip, else the selected
  // one, else the first); arrow keys move between chips.
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // A row swap (toggle or a changed field value) invalidates the roving index.
  const [prevHigh, setPrevHigh] = useState(high)
  if (prevHigh !== high) {
    setPrevHigh(high)
    setActiveIndex(null)
  }
  const selectedIndex = values.findIndex((v) => isKitValueSelected(value, v))
  const tabStop = Math.min(
    activeIndex ?? (selectedIndex >= 0 ? selectedIndex : 0),
    values.length - 1,
  )

  const onChipKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = values.length - 1
    const target =
      e.key === 'ArrowRight'
        ? Math.min(index + 1, last)
        : e.key === 'ArrowLeft'
          ? Math.max(index - 1, 0)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (target === null) return
    e.preventDefault()
    setActiveIndex(target)
    chipRefs.current[target]?.focus()
  }

  return (
    <div className="kit">
      {metric === 'pH' && (
        <button
          type="button"
          className="kit-chip kit-range"
          aria-pressed={high}
          disabled={disabled}
          onClick={() => {
            setHighChosen(!high)
            setActiveIndex(null)
          }}
        >
          High-range kit
        </button>
      )}
      {children}
      <div className="kit-chips" role="group" aria-label={`${GROUP_NAME[metric]} kit values`}>
        {values.map((v, i) => {
          const selected = isKitValueSelected(value, v)
          return (
            <button
              key={v}
              ref={(el) => {
                chipRefs.current[i] = el
              }}
              type="button"
              className="kit-chip"
              tabIndex={i === tabStop ? 0 : -1}
              aria-pressed={selected}
              aria-label={`${METRIC_SHORT[metric]} ${formatKitValue(metric, v)}`}
              disabled={disabled}
              onFocus={() => setActiveIndex(i)}
              onKeyDown={(e) => onChipKeyDown(e, i)}
              onClick={() => {
                // Latch the row so clearing the value cannot swap the row under the focused chip.
                if (highChosen === null) setHighChosen(high)
                onChange(selected ? '' : String(v))
              }}
            >
              {formatKitValue(metric, v)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
