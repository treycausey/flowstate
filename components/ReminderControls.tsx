"use client"

import { useEffect, useMemo, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { listReadingsByTank, setTankReminderCadence } from '@/lib/idb'
import { isDue, snooze24h, skipOnce } from '@/lib/reminders'

const PRESETS = [
  { label: 'Daily', days: 1 },
  { label: 'Every 3 days', days: 3 },
  { label: 'Weekly', days: 7 },
]

export default function ReminderControls() {
  const { activeTankId, tanks } = useTanks()
  const tank = useMemo(() => tanks.find((t) => t.id === activeTankId), [tanks, activeTankId])
  const [customDays, setCustomDays] = useState<string>('')
  const [lastTs, setLastTs] = useState<string | null>(null)
  const [due, setDue] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!activeTankId) return
      const r = await listReadingsByTank(activeTankId)
      setLastTs(r.length ? r[r.length - 1].ts : null)
      setDue(isDue(r.length ? r[r.length - 1].ts : null, tank?.reminderCadence ?? null, activeTankId))
    }
    load()
  }, [activeTankId, tank?.reminderCadence])

  if (!tank) return null

  const setCadence = async (days: number | null) => {
    await setTankReminderCadence(tank.id, days)
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button key={p.days} onClick={() => setCadence(p.days)} aria-pressed={tank.reminderCadence === p.days}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setCadence(null)} aria-pressed={!tank.reminderCadence}>
          Off
        </button>
        <label style={{ marginLeft: 8 }}>
          Custom N days
          <input
            type="number"
            min={1}
            step={1}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            style={{ width: 80, marginLeft: 6 }}
          />
        </label>
        <button onClick={() => setCadence(customDays ? Number(customDays) : null)}>Set</button>
      </div>
      <div style={{ fontSize: 12, color: '#555' }}>
        Last reading: {lastTs ? new Date(lastTs).toLocaleString() : 'none'} · Cadence:{' '}
        {tank.reminderCadence ? `${tank.reminderCadence} days` : 'Off'}
      </div>
      {due && (
        <div role="status" aria-live="polite" style={{ background: '#fff7ed', padding: 8, border: '1px solid #f97316' }}>
          <strong>Reminder:</strong> Time to test water for this tank.
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={() => { snooze24h(tank.id); setDue(false) }}>Snooze 24h</button>
            <button onClick={() => { skipOnce(tank.id, tank.reminderCadence ?? 0, lastTs); setDue(false) }}>Skip</button>
          </div>
        </div>
      )}
    </div>
  )
}

