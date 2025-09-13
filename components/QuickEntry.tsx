"use client"

import { useEffect, useMemo, useState } from 'react'
import { addReading, findMostRecentReading, listReadingsWithinHour } from '@/lib/idb'
import { useTanks } from '@/components/TankProvider'
import { STEP } from '@/lib/models'
import { normalizeInput } from '@/lib/validation'
import { emitReadingsChanged } from '@/lib/events'
import InstructionsModal from '@/components/InstructionsModal'
import ProgressRing from '@/components/ProgressRing'
import { useRef } from 'react'

type TimerRow = {
  id: string
  label: string
  totalMs: number
  startedAt: number
  notified?: boolean
}

type FormState = {
  ts: string // datetime-local value
  pH: string
  ammonia: string
  nitrite: string
  nitrate: string
  note: string
}

const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16)

export default function QuickEntry() {
  const { activeTankId } = useTanks()
  const [state, setState] = useState<FormState>({
    ts: nowLocal(),
    pH: '',
    ammonia: '',
    nitrite: '',
    nitrate: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [timers, setTimers] = useState<TimerRow[]>([])
  const [now, setNow] = useState(Date.now())
  const tickRef = useRef<number | null>(null)
  const disabled = useMemo(() => !activeTankId || saving, [activeTankId, saving])

  useEffect(() => {
    // Reset timestamp on mount/change
    setState((s) => ({ ...s, ts: nowLocal() }))
  }, [activeTankId])

  // global tick for timers
  useEffect(() => {
    tickRef.current = window.setInterval(() => setNow(Date.now()), 250)
    return () => { if (tickRef.current) window.clearInterval(tickRef.current) }
  }, [])

  // notify on finished timers exactly once
  useEffect(() => {
    setTimers((prev) => prev.map((t) => {
      const remaining = t.totalMs - (now - t.startedAt)
      if (remaining <= 0 && !t.notified) {
        // buzz
        try {
          if ('vibrate' in navigator) (navigator as any).vibrate?.([120, 60, 120])
          const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
          if (Ctx) {
            const ctx = new Ctx()
            const o = ctx.createOscillator(); const g = ctx.createGain()
            o.type = 'sine'; o.frequency.value = 880
            o.connect(g); g.connect(ctx.destination)
            o.start(); g.gain.setValueAtTime(0.0001, ctx.currentTime)
            g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
            o.stop(ctx.currentTime + 0.5)
          }
        } catch { /* noop */ }
        return { ...t, notified: true }
      }
      return t
    }))
  }, [now])

  const startTimer = (label: string, ms: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setTimers((prev) => [...prev, { id, label, totalMs: ms, startedAt: Date.now() }])
  }

  const stopTimer = (id: string) => setTimers((prev) => prev.filter((t) => t.id !== id))
  const clearAllTimers = () => setTimers([])

  const formatRemaining = (t: TimerRow) => {
    const remaining = Math.max(0, Math.ceil((t.totalMs - (now - t.startedAt)) / 1000))
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const useLastValues = async () => {
    if (!activeTankId) return
    const last = await findMostRecentReading(activeTankId)
    if (!last) return
    setState((s) => ({
      ...s,
      pH: String(last.pH),
      ammonia: String(last.ammonia),
      nitrite: String(last.nitrite),
      nitrate: String(last.nitrate),
    }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTankId) return
    setSaving(true)
    try {
      const tsISO = new Date(state.ts).toISOString()
      // Duplicate guard
      const near = await listReadingsWithinHour(activeTankId, tsISO)
      if (near.length > 0) {
        const proceed = window.confirm(
          'You already have a reading within an hour of this time. Save anyway?'
        )
        if (!proceed) return
      }
      await addReading({
        tankId: activeTankId,
        ts: tsISO,
        pH: normalizeInput('pH', Number(state.pH)),
        ammonia: normalizeInput('ammonia', Number(state.ammonia)),
        nitrite: normalizeInput('nitrite', Number(state.nitrite)),
        nitrate: normalizeInput('nitrate', Number(state.nitrate)),
        note: state.note || undefined,
      })
      emitReadingsChanged(activeTankId)
      // Reset values but keep note
      setState({ ts: nowLocal(), pH: '', ammonia: '', nitrite: '', nitrate: '', note: '' })
      alert('Saved')
    } finally {
      setSaving(false)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setState((s) => ({ ...s, [name]: value }))
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ maxWidth: 480 }}>
      <label>
        Timestamp
        <input
          type="datetime-local"
          name="ts"
          value={state.ts}
          onChange={onChange}
          disabled={disabled}
        />
      </label>
      <label>
        pH
        <input type="number" step={STEP.pH} name="pH" value={state.pH} onChange={onChange} disabled={disabled} />
      </label>
      <label>
        Ammonia (NH3, ppm)
        <input
          type="number"
          step={STEP.ammonia}
          name="ammonia"
          value={state.ammonia}
          onChange={onChange}
          disabled={disabled}
        />
      </label>
      <label>
        Nitrite (NO2, ppm)
        <input
          type="number"
          step={STEP.nitrite}
          name="nitrite"
          value={state.nitrite}
          onChange={onChange}
          disabled={disabled}
        />
      </label>
      <label>
        Nitrate (NO3, ppm)
        <input
          type="number"
          step={STEP.nitrate}
          name="nitrate"
          value={state.nitrate}
          onChange={onChange}
          disabled={disabled}
        />
      </label>
      <label>
        Note
        <input name="note" value={state.note} onChange={onChange} disabled={disabled} />
      </label>
      <div className="cluster">
        <button
          className="button button--ghost"
          type="button"
          onClick={() => setShowInstructions(true)}
        >
          Instructions
        </button>
        <button className="button button--ghost" type="button" onClick={useLastValues} disabled={disabled}>
          Use last values
        </button>
        <button className="button" type="submit" disabled={disabled}>
          Save
        </button>
      </div>
      {timers.length > 0 && (
        <div className="card" aria-live="polite">
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <strong>Timers</strong>
            <button type="button" className="button button--ghost" onClick={clearAllTimers}>Clear all</button>
          </div>
          <div className="stack" style={{ marginTop: '0.5rem' }}>
            {timers.map((t) => {
              const elapsed = now - t.startedAt
              const done = elapsed >= t.totalMs
              const frac = Math.max(0, Math.min(1, elapsed / t.totalMs))
              return (
                <div key={t.id} className="cluster" style={{ justifyContent: 'space-between' }}>
                  <div className="cluster" style={{ gap: '0.75rem' }}>
                    <ProgressRing
                      progress={frac}
                      color={done ? 'var(--danger)' : 'var(--accent)'}
                      testId="timer-ring"
                    />
                    <div>
                      <strong>{t.label}</strong>{' '}
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatRemaining(t)}</span>
                      {done && <span className="danger" style={{ marginLeft: '0.5rem' }}>(Done)</span>}
                    </div>
                  </div>
                  <button type="button" className="button button--ghost" onClick={() => stopTimer(t.id)}>Dismiss</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <InstructionsModal open={showInstructions} onClose={() => setShowInstructions(false)} onStartTimer={startTimer} />
    </form>
  )
}
