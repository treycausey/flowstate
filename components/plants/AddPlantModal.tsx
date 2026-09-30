'use client'

import { useState } from 'react'
import { addPlant } from '@/lib/idb'
import { emitPlantsChanged } from '@/lib/events'
import type { Plant } from '@/lib/models'
import type { PlantSpecies } from '@/lib/plants/types'
import Modal from './Modal'
import PlantForm, { type PlantFormValues } from './PlantForm'
import PlantThumb from './PlantThumb'
import SpeciesPicker from './SpeciesPicker'

type Step = { kind: 'pick' } | { kind: 'form'; species: PlantSpecies | null }

type Props = {
  tankId: string
  /** Start on the form for this species (Learn's "Add to this tank"). */
  initialSpecies?: PlantSpecies | null
  onClose: () => void
  onAdded: (plant: Plant) => void
}

const LIGHT_TEXT = { low: 'Low light', medium: 'Medium light', high: 'High light' } as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Pick from the catalog (or make a custom plant), then save. Two taps for a typical add. */
export default function AddPlantModal({ tankId, initialSpecies, onClose, onAdded }: Props) {
  const [step, setStep] = useState<Step>(
    initialSpecies ? { kind: 'form', species: initialSpecies } : { kind: 'pick' },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (values: PlantFormValues, species: PlantSpecies | null) => {
    setSaving(true)
    setError(null)
    try {
      const plant = await addPlant({
        tankId,
        speciesId: species?.id ?? null,
        name: values.name,
        placement: values.placement,
        plantedAt: values.plantedAt.toISOString(),
        removedAt: null,
        ...(values.note ? { note: values.note } : {}),
      })
      emitPlantsChanged(tankId)
      onAdded(plant)
    } catch (err) {
      console.error('Failed to add plant', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  return (
    <Modal
      labelledBy="add-plant-title"
      onClose={onClose}
      initialFocus={initialSpecies ? '.plant-form button[type=submit]' : 'input[type=search]'}
    >
      <div className="stack">
        <div className="cluster plant-modal__head">
          <h3 id="add-plant-title" style={{ margin: 0 }}>
            {step.kind === 'form' && !step.species ? 'Custom plant' : 'Add a plant'}
          </h3>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {step.kind === 'pick' ? (
          <SpeciesPicker
            onSelect={(species) => setStep({ kind: 'form', species })}
            footer={
              <button
                type="button"
                className="button button--ghost picker__custom"
                onClick={() => setStep({ kind: 'form', species: null })}
              >
                Add a custom plant
              </button>
            }
          />
        ) : (
          <>
            {!initialSpecies && (
              <button
                type="button"
                className="button button--ghost button--small plant-back"
                onClick={() => {
                  setError(null)
                  setStep({ kind: 'pick' })
                }}
              >
                ← Back to the list
              </button>
            )}
            {step.species && (
              <div className="plant-summary">
                <PlantThumb speciesId={step.species.id} placement={step.species.placement} />
                <span className="picker__text">
                  <span className="picker__name">{step.species.name}</span>
                  <span className="picker__sci">{step.species.scientific}</span>
                  <span className="picker__meta">
                    {cap(step.species.difficulty)} · {LIGHT_TEXT[step.species.light]}
                  </span>
                </span>
              </div>
            )}
            <PlantForm
              key={step.species?.id ?? 'custom'}
              initial={{
                name: step.species?.name ?? '',
                placement: step.species?.placement ?? 'midground',
              }}
              nameHint={
                step.species ? 'Rename it if you have several of the same plant.' : undefined
              }
              focusOn={step.species ? 'submit' : 'name'}
              submitLabel="Add plant"
              saving={saving}
              error={error}
              onSubmit={(values) => save(values, step.species)}
              onCancel={onClose}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
