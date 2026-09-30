'use client'

import { useId, useMemo, useState } from 'react'
import { addPlantCheck } from '@/lib/idb'
import { emitPlantsChanged } from '@/lib/events'
import type { Plant, PlantCheck } from '@/lib/models'
import { getSpecies } from '@/lib/plants/catalog'
import { HEALTH_HINT, HEALTH_LABEL, HEALTH_TONE, SYMPTOMS } from '@/lib/plants/health'
import {
  ACTIONS,
  HEALTH_LEVELS,
  SYMPTOM_IDS,
  type Health,
  type PlantAction,
  type SymptomId,
} from '@/lib/plants/types'
import Modal from './Modal'
import { ToggleChip } from './ui'

const ACTION_LABEL: Record<PlantAction, string> = {
  trimmed: 'Trimmed',
  replanted: 'Replanted',
  moved: 'Moved',
  fed: 'Fed the plant',
  cleaned: 'Cleaned leaves',
  none: 'Did nothing',
}

type Props = {
  plant: Plant
  onClose: () => void
  onSaved: (check: PlantCheck) => void
}

/** How does it look today? One tap for health, then Save. Symptoms and actions are optional. */
export default function CheckHealthModal({ plant, onClose, onSaved }: Props) {
  const id = useId()
  const species = getSpecies(plant.speciesId)
  const [health, setHealth] = useState<Health | null>(null)
  const [symptoms, setSymptoms] = useState<SymptomId[]>([])
  const [lastSymptom, setLastSymptom] = useState<SymptomId | null>(null)
  const [action, setAction] = useState<PlantAction | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Problems typical for this species first, then the rest in the catalog order.
  const symptomOrder = useMemo(() => {
    const common: readonly SymptomId[] = species?.commonProblems ?? []
    return [...common, ...SYMPTOM_IDS.filter((s) => !common.includes(s))]
  }, [species])

  const toggleSymptom = (s: SymptomId) => {
    setError(null)
    if (symptoms.includes(s)) {
      setSymptoms(symptoms.filter((x) => x !== s))
      setLastSymptom(null)
    } else {
      setSymptoms([...symptoms, s])
      setLastSymptom(s)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!health) {
      setError('Choose how the plant looks.')
      document.getElementById(`${id}-health`)?.querySelector('button')?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const trimmed = note.trim()
      const check = await addPlantCheck({
        plantId: plant.id,
        tankId: plant.tankId,
        ts: new Date().toISOString(),
        health,
        symptoms: SYMPTOM_IDS.filter((s) => symptoms.includes(s)),
        action,
        ...(trimmed ? { note: trimmed } : {}),
      })
      emitPlantsChanged(plant.tankId)
      onSaved(check)
    } catch (err) {
      console.error('Failed to save plant check', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  return (
    <Modal labelledBy={`${id}-title`} onClose={onClose} initialFocus="[data-first-health]">
      <form className="stack plant-form" onSubmit={save} noValidate>
        <div className="cluster plant-modal__head">
          <div>
            <h3 id={`${id}-title`} style={{ margin: 0 }}>
              Check health
            </h3>
            <p className="muted plant-modal__sub">{plant.name}</p>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="field">
          <span className="field-label" id={`${id}-health-label`}>
            How does it look?
          </span>
          <div
            className="chips chips--health"
            id={`${id}-health`}
            role="group"
            aria-labelledby={`${id}-health-label`}
          >
            {HEALTH_LEVELS.map((h, i) => (
              <button
                key={h}
                type="button"
                className={`choice-chip choice-chip--health choice-chip--${HEALTH_TONE[h]}`}
                aria-pressed={health === h}
                data-first-health={i === 0 ? '' : undefined}
                onClick={() => {
                  setHealth(h)
                  setError(null)
                }}
              >
                <span className="choice-chip__dot" aria-hidden="true" />
                {HEALTH_LABEL[h]}
              </button>
            ))}
          </div>
          <p className="field-note muted" role="status">
            {health ? HEALTH_HINT[health] : ' '}
          </p>
        </div>

        <div className="field">
          <span className="field-label" id={`${id}-symptoms-label`}>
            Any of these? <span className="muted">Optional</span>
          </span>
          <div className="chips" role="group" aria-labelledby={`${id}-symptoms-label`}>
            {symptomOrder.map((s) => (
              <ToggleChip
                key={s}
                pressed={symptoms.includes(s)}
                onClick={() => toggleSymptom(s)}
                aria-describedby={lastSymptom === s ? `${id}-symptom-explain` : undefined}
              >
                {SYMPTOMS[s].label}
              </ToggleChip>
            ))}
          </div>
          <p id={`${id}-symptom-explain`} className="field-note muted" role="status">
            {lastSymptom ? SYMPTOMS[lastSymptom].explain : ' '}
          </p>
        </div>

        <div className="field">
          <span className="field-label" id={`${id}-action-label`}>
            What did you do? <span className="muted">Optional</span>
          </span>
          <div className="chips" role="group" aria-labelledby={`${id}-action-label`}>
            {ACTIONS.map((a) => (
              <ToggleChip
                key={a}
                pressed={action === a}
                onClick={() => setAction(action === a ? null : a)}
              >
                {ACTION_LABEL[a]}
              </ToggleChip>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${id}-note`}>Note</label>
          <input
            id={`${id}-note`}
            type="text"
            maxLength={200}
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div role="alert" className="danger">
            {error}
          </div>
        )}
        <div className="cluster plant-actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : 'Save check'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
