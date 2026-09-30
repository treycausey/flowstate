'use client'

import { useId, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { setTankVolume } from '@/lib/idb'
import { emitStockChanged } from '@/lib/events'
import type { Tank } from '@/lib/models'
import { litresToGallons } from '@/lib/stock/format'

/** Water volume of a tank in litres, with a US gallons helper. Saves on the Save button. */
export default function VolumeField({ tank }: { tank: Tank }) {
  const id = useId()
  const { refresh } = useTanks()
  const saved = tank.volumeL ?? null
  const [text, setText] = useState(saved === null ? '' : String(saved))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const parsed = text.trim() === '' ? null : Number(text.replace(',', '.'))
  const invalid = parsed !== null && !(Number.isFinite(parsed) && parsed > 0 && parsed <= 100000)
  const dirty = !invalid && parsed !== saved

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (invalid) {
      setMessage({ kind: 'error', text: 'Enter a volume in litres, for example 60.' })
      document.getElementById(id)?.focus()
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await setTankVolume(tank.id, parsed)
    } catch (err) {
      console.error('Failed to save tank volume', err)
      setMessage({
        kind: 'error',
        text: `Couldn’t save: ${err instanceof Error ? err.message : String(err)}`,
      })
      setSaving(false)
      return
    }
    try {
      await refresh()
      emitStockChanged(tank.id)
      setMessage({ kind: 'ok', text: parsed === null ? 'Volume cleared.' : 'Volume saved.' })
    } catch (err) {
      console.error('Failed to refresh tanks after saving volume', err)
      emitStockChanged(tank.id)
      setMessage({
        kind: 'error',
        text: `Volume saved, but the screen couldn’t refresh: ${err instanceof Error ? err.message : String(err)}. Reload the page to see it.`,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="volume-field" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor={id}>Tank volume</label>
        <div className="volume-field__row">
          <div className="volume-field__input">
            <input
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 60"
              value={text}
              aria-invalid={invalid || undefined}
              aria-describedby={`${id}-note`}
              onChange={(e) => {
                setText(e.target.value)
                setMessage(null)
              }}
            />
            <span className="volume-field__unit" aria-hidden="true">
              L
            </span>
          </div>
          <span className="muted volume-field__gal" id={`${id}-note`}>
            {parsed !== null && !invalid
              ? `about ${litresToGallons(parsed).toFixed(1)} US gal`
              : 'litres; used for a rough stocking estimate'}
          </span>
          <button type="submit" className="button button--ghost" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div role="status" aria-live="polite">
        {message && (
          <span className={message.kind === 'error' ? 'danger' : 'muted'}>{message.text}</span>
        )}
      </div>
    </form>
  )
}
