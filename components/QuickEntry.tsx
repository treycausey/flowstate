'use client'

import { useEffect, useRef, useState } from 'react'
import { addReading, findMostRecentReading, listReadingsWithinHour } from '@/lib/idb'
import { useTanks } from '@/components/TankProvider'
import { BOUNDS, METRICS, STEP, type Metric } from '@/lib/models'
import { parseMetricInput } from '@/lib/validation'
import { emitReadingsChanged } from '@/lib/events'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/time'
import InstructionsModal from '@/components/InstructionsModal'
import ProgressRing from '@/components/ProgressRing'

type TimerRow = {
  id: string
  label: string
  totalMs: number
  startedAt: number
  notified?: boolean
}

type FormState = Record<Metric, string> & {
  ts: string // datetime-local value
  note: string
}

type Errors = Partial<Record<Metric | 'ts' | 'form', string>>

const FIELD_LABEL: Record<Metric, string> = {
  pH: 'pH',
  ammonia: 'Ammonia (NH3/NH4+, ppm)',
  nitrite: 'Nitrite (NO2, ppm)',
  nitrate: 'Nitrate (NO3, ppm)',
}

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

const emptyValues = () => ({ pH: '', ammonia: '', nitrite: '', nitrate: '', note: '' })

function beep(ctxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    navigator.vibrate?.([120, 60, 120])
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = (ctxRef.current ??= new Ctor())
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    /* audio/vibration unavailable */
  }
}

export default function QuickEntry() {
  const { activeTankId } = useTanks()
  const [state, setState] = useState<FormState>(() => ({
    ts: toDatetimeLocalValue(new Date()),
    ...emptyValues(),
  }))
  // While untouched, the timestamp tracks "now" at save time rather than page-load time
  const [tsTouched, setTsTouched] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [timers, setTimers] = useState<TimerRow[]>([])
  const [now, setNow] = useState(() => Date.now())
  const audioRef = useRef<AudioContext | null>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const disabled = !activeTankId || saving
  const hasTimers = timers.length > 0

  useEffect(() => {
    setTsTouched(false)
    setState((s) => ({ ...s, ts: toDatetimeLocalValue(new Date()) }))
    setErrors({})
    setStatus(null)
  }, [activeTankId])

  // Tick only while timers are running
  useEffect(() => {
    if (!hasTimers) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [hasTimers])

  useEffect(() => () => void audioRef.current?.close().catch(() => {}), [])

  // Alert once per finished timer
  useEffect(() => {
    if (!timers.some((t) => !t.notified && now - t.startedAt >= t.totalMs)) return
    beep(audioRef)
    setTimers((prev) =>
      prev.map((t) =>
        !t.notified && now - t.startedAt >= t.totalMs ? { ...t, notified: true } : t,
      ),
    )
  }, [now, timers])

  const startTimer = (label: string, ms: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const startedAt = Date.now()
    setNow(startedAt)
    setTimers((prev) => [...prev, { id, label, totalMs: ms, startedAt }])
  }

  const stopTimer = (id: string) => setTimers((prev) => prev.filter((t) => t.id !== id))
  const clearAllTimers = () => setTimers([])

  const formatRemaining = (t: TimerRow) => {
    const remaining = Math.max(0, Math.ceil((t.totalMs - (now - t.startedAt)) / 1000))
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const fillLastValues = async () => {
    if (!activeTankId) return
    const last = await findMostRecentReading(activeTankId)
    if (!last) {
      setStatus('No previous reading for this tank yet.')
      return
    }
    setErrors({})
    setState((s) => ({
      ...s,
      pH: String(last.pH),
      ammonia: String(last.ammonia),
      nitrite: String(last.nitrite),
      nitrate: String(last.nitrate),
    }))
  }

  const validate = () => {
    const next: Errors = {}
    const values = {} as Record<Metric, number>
    for (const m of METRICS) {
      const res = parseMetricInput(m, state[m])
      if (res.ok) values[m] = res.value
      else next[m] = res.error
    }
    const when = tsTouched ? fromDatetimeLocalValue(state.ts) : new Date()
    if (!when) next.ts = 'Enter a date and time'
    else if (when.getTime() > Date.now() + FUTURE_TOLERANCE_MS) next.ts = 'Can’t be in the future'
    return { errors: next, values, when }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTankId || saving) return
    setStatus(null)
    const { errors: found, values, when } = validate()
    setErrors(found)
    if (Object.keys(found).length > 0 || !when) {
      const firstBad = (['ts', ...METRICS] as const).find((k) => found[k])
      document.getElementById(`qe-${firstBad}`)?.focus()
      return
    }
    setSaving(true)
    try {
      const tsISO = when.toISOString()
      const near = await listReadingsWithinHour(activeTankId, tsISO)
      if (near.length > 0) {
        const proceed = window.confirm(
          'You already have a reading within an hour of this time. Save anyway?',
        )
        if (!proceed) return
      }
      const note = state.note.trim()
      await addReading({ tankId: activeTankId, ts: tsISO, ...values, note: note || undefined })
      emitReadingsChanged(activeTankId)
      setTsTouched(false)
      setState({ ts: toDatetimeLocalValue(new Date()), ...emptyValues() })
      setStatus('Reading saved.')
      firstFieldRef.current?.focus()
    } catch (err) {
      setErrors({ form: `Couldn’t save: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setSaving(false)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'ts') setTsTouched(true)
    setStatus(null)
    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }))
    setState((s) => ({ ...s, [name]: value }))
  }

  const describedBy = (key: keyof Errors) => (errors[key] ? `qe-${key}-error` : undefined)

  return (
    <form onSubmit={onSubmit} className="stack quick-entry" noValidate>
      <div className="field">
        <label htmlFor="qe-ts">Date &amp; time</label>
        <input
          id="qe-ts"
          type="datetime-local"
          name="ts"
          value={state.ts}
          max={toDatetimeLocalValue(new Date(Date.now() + FUTURE_TOLERANCE_MS))}
          onChange={onChange}
          onFocus={() => {
            // Refresh the default before the user starts editing it
            if (!tsTouched) setState((s) => ({ ...s, ts: toDatetimeLocalValue(new Date()) }))
          }}
          disabled={disabled}
          aria-invalid={!!errors.ts}
          aria-describedby={describedBy('ts')}
        />
        {errors.ts && (
          <span id="qe-ts-error" className="field-error">
            {errors.ts}
          </span>
        )}
      </div>
      <div className="metric-grid">
        {METRICS.map((m, i) => (
          <div className="field" key={m}>
            <label htmlFor={`qe-${m}`}>{FIELD_LABEL[m]}</label>
            <input
              id={`qe-${m}`}
              ref={i === 0 ? firstFieldRef : undefined}
              type="number"
              inputMode="decimal"
              step={STEP[m]}
              min={BOUNDS[m].min}
              max={BOUNDS[m].max}
              name={m}
              value={state[m]}
              onChange={onChange}
              disabled={disabled}
              aria-invalid={!!errors[m]}
              aria-describedby={describedBy(m)}
            />
            {errors[m] && (
              <span id={`qe-${m}-error`} className="field-error">
                {errors[m]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="qe-note">Note</label>
        <input
          id="qe-note"
          name="note"
          value={state.note}
          onChange={onChange}
          disabled={disabled}
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <div className="cluster">
        <button className="button" type="submit" disabled={disabled}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="button button--ghost"
          type="button"
          onClick={fillLastValues}
          disabled={disabled}
        >
          Use last values
        </button>
        <button
          className="button button--ghost"
          type="button"
          onClick={() => setShowInstructions(true)}
        >
          Test instructions
        </button>
      </div>
      <div aria-live="polite" role="status" className="form-status">
        {errors.form ? <span className="danger">{errors.form}</span> : status}
      </div>
      {timers.length > 0 && (
        <div className="card" aria-live="polite">
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <strong>Timers</strong>
            <button type="button" className="button button--ghost" onClick={clearAllTimers}>
              Clear all
            </button>
          </div>
          <div className="stack" style={{ marginTop: '0.5rem', gap: 'var(--space-3)' }}>
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
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatRemaining(t)}
                      </span>
                      {done && (
                        <span className="danger" style={{ marginLeft: '0.5rem' }}>
                          (Done)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => stopTimer(t.id)}
                  >
                    Dismiss
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <InstructionsModal
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
        onStartTimer={startTimer}
      />
    </form>
  )
}
