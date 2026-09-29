'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { findMostRecentReading, setTankReminderCadence } from '@/lib/idb'
import { onReadingsChanged } from '@/lib/events'
import { effectiveDue, parseCadence, shouldNotify, skipOnce, snooze24h } from '@/lib/reminders'
import { formatLocal } from '@/lib/time'
import { showSystemNotification } from '@/lib/notify'

const PRESETS = [
  { label: 'Daily', days: 1 },
  { label: 'Every 3 days', days: 3 },
  { label: 'Weekly', days: 7 },
]

const RECHECK_MS = 60 * 1000

export default function ReminderControls() {
  const { activeTank, refresh } = useTanks()
  const tankId = activeTank?.id ?? null
  const cadence = activeTank?.reminderCadence ?? null
  const [customDays, setCustomDays] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const [lastTs, setLastTs] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  // Snooze/skip live in localStorage; bumping this re-renders so `due` is recomputed
  const [, setStateVersion] = useState(0)

  useEffect(() => {
    if (!tankId) return
    let mounted = true
    const load = async () => {
      const last = await findMostRecentReading(tankId)
      if (mounted) setLastTs(last?.ts ?? null)
    }
    load()
    const off = onReadingsChanged((id) => id === tankId && load())
    return () => {
      mounted = false
      off()
    }
  }, [tankId])

  // Re-evaluate periodically so a reminder appears without a reload
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), RECHECK_MS)
    return () => window.clearInterval(id)
  }, [])

  const due = tankId ? effectiveDue(lastTs, cadence, tankId, now) : null
  const isDueNow = !!due && due <= now

  useEffect(() => {
    if (!isDueNow || !due || !tankId || !activeTank) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!shouldNotify(tankId, due)) return
    showSystemNotification(
      'Time to test your water',
      `${activeTank.name} is due for a water test.`,
      `due-${tankId}`,
    )
  }, [isDueNow, due, tankId, activeTank])

  const setCadence = useCallback(
    async (days: number | null) => {
      if (!tankId) return
      await setTankReminderCadence(tankId, days)
      await refresh()
    },
    [tankId, refresh],
  )

  if (!activeTank || !tankId) return null

  const applyCustom = () => {
    const days = parseCadence(customDays)
    if (days === null) {
      setCustomError('Enter whole days from 1 to 365')
      return
    }
    setCustomError(null)
    setCustomDays('')
    setCadence(days)
  }

  const isPreset = PRESETS.some((p) => p.days === cadence)

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      {isDueNow && (
        <div role="status" className="notice notice--due">
          <strong>Time to test the water</strong> for {activeTank.name}.
          <div className="cluster" style={{ marginTop: 'var(--space-2)' }}>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                snooze24h(tankId)
                setStateVersion((v) => v + 1)
              }}
            >
              Snooze 24h
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                skipOnce(tankId, cadence ?? 0, lastTs)
                setStateVersion((v) => v + 1)
              }}
            >
              Skip this one
            </button>
          </div>
        </div>
      )}
      <div className="cluster" role="group" aria-label="Test reminder cadence">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.days}
            className="button button--toggle"
            onClick={() => setCadence(p.days)}
            aria-pressed={cadence === p.days}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="button button--toggle"
          onClick={() => setCadence(null)}
          aria-pressed={!cadence}
        >
          Off
        </button>
      </div>
      <form
        className="cluster"
        style={{ alignItems: 'flex-end' }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          applyCustom()
        }}
      >
        <label style={{ width: '9rem' }}>
          Every N days
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            step={1}
            value={customDays}
            placeholder={cadence && !isPreset ? String(cadence) : ''}
            onChange={(e) => {
              setCustomError(null)
              setCustomDays(e.target.value)
            }}
            aria-invalid={!!customError}
            aria-describedby={customError ? 'cadence-error' : undefined}
          />
        </label>
        <button type="submit" className="button button--ghost">
          Set
        </button>
        {customError && (
          <span id="cadence-error" className="field-error">
            {customError}
          </span>
        )}
      </form>
      <p className="muted small" style={{ margin: 0 }}>
        Last test: {lastTs ? formatLocal(new Date(lastTs)) : 'none yet'}
        {' · '}
        {cadence
          ? `Every ${cadence === 1 ? 'day' : `${cadence} days`}${
              due && !isDueNow ? ` · next ${formatLocal(due)}` : ''
            }`
          : 'Reminders off'}
      </p>
    </div>
  )
}
