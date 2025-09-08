"use client"

import { useEffect, useMemo, useState } from 'react'
import { addReading, findMostRecentReading, listReadingsWithinHour } from '@/lib/idb'
import { useTanks } from '@/components/TankProvider'
import { STEP } from '@/lib/models'
import { normalizeInput } from '@/lib/validation'

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
  const disabled = useMemo(() => !activeTankId || saving, [activeTankId, saving])

  useEffect(() => {
    // Reset timestamp on mount/change
    setState((s) => ({ ...s, ts: nowLocal() }))
  }, [activeTankId])

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
        <button className="button button--ghost" type="button" onClick={useLastValues} disabled={disabled}>
          Use last values
        </button>
        <button className="button" type="submit" disabled={disabled}>
          Save
        </button>
      </div>
    </form>
  )
}
