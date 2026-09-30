'use client'

import { useState } from 'react'
import type { StockEvent } from '@/lib/models'
import { recordFed } from '@/lib/stock/actions'
import { fedToday, lastFedAt } from '@/lib/stock/feeding'
import { formatLocal } from '@/lib/time'

const timeOnly = { hour: 'numeric', minute: '2-digit' } as const
const dayTime = { weekday: 'short', hour: 'numeric', minute: '2-digit' } as const

/** "Fed today at 8:10", "Last fed Tue 8:10" or "Not fed yet". */
export function fedText(events: readonly StockEvent[], now: Date): string {
  const last = lastFedAt(events)
  if (!last) return 'Not fed yet'
  if (fedToday(events, now)) return `Fed today at ${formatLocal(last, undefined, timeOnly)}`
  return `Last fed ${formatLocal(last, undefined, dayTime)}`
}

/** The feeding row: what happened last, and one big tap to record a feeding now. */
export default function FedBar({
  tankId,
  events,
  now,
  disabled,
}: {
  tankId: string
  events: readonly StockEvent[]
  now: Date
  disabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fed = fedToday(events, now)

  const feed = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await recordFed(tankId)
    } catch (err) {
      console.error('Failed to record feeding', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stock-fed">
      <p className="stock-fed__text" role="status">
        <span className={fed ? 'stock-fed__state stock-fed__state--done' : 'stock-fed__state'}>
          {fedText(events, now)}
        </span>
        <span className="stock-fed__hint muted">Feed small amounts once or twice a day.</span>
      </p>
      <button
        type="button"
        className="button stock-fed__button"
        onClick={feed}
        disabled={saving || disabled}
      >
        Fed
      </button>
      {error && (
        <div role="alert" className="danger stock-fed__error">
          {error}
        </div>
      )}
    </div>
  )
}
