'use client'

import { useState } from 'react'
import Modal from '@/components/plants/Modal'
import { addStock } from '@/lib/idb'
import { emitStockChanged } from '@/lib/events'
import type { StockGroup } from '@/lib/models'
import { tempRangeShort } from '@/lib/stock/format'
import { ZONE_LABEL, type StockSpecies } from '@/lib/stock/types'
import StockForm, { type StockFormValues } from './StockForm'
import StockPicker, { BettaBadge } from './StockPicker'
import StockThumb from './StockThumb'

type Step = { kind: 'pick' } | { kind: 'form'; species: StockSpecies | null }

type Props = {
  tankId: string
  /** True when the tank already has a betta, so the form can warn about a poor match. */
  hasBetta: boolean
  /** Start on the form for this species (Learn's "Add to this tank"). */
  initialSpecies?: StockSpecies | null
  onClose: () => void
  onAdded: (group: StockGroup) => void
}

/** Pick from the catalog (or make a custom species), then save. Two taps for a typical add. */
export default function AddStockModal({
  tankId,
  hasBetta,
  initialSpecies,
  onClose,
  onAdded,
}: Props) {
  const [step, setStep] = useState<Step>(
    initialSpecies ? { kind: 'form', species: initialSpecies } : { kind: 'pick' },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (values: StockFormValues, species: StockSpecies | null) => {
    setSaving(true)
    setError(null)
    try {
      const group = await addStock({
        tankId,
        speciesId: species?.id ?? null,
        name: values.name,
        count: values.count,
        addedAt: values.addedAt.toISOString(),
        removedAt: null,
        ...(values.note ? { note: values.note } : {}),
      })
      emitStockChanged(tankId)
      onAdded(group)
    } catch (err) {
      console.error('Failed to add stock', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  return (
    <Modal
      labelledBy="add-stock-title"
      onClose={onClose}
      initialFocus={initialSpecies ? '.plant-form button[type=submit]' : 'input[type=search]'}
    >
      <div className="stack">
        <div className="cluster plant-modal__head">
          <h3 id="add-stock-title" style={{ margin: 0 }}>
            {step.kind === 'form' && !step.species ? 'Custom animal' : 'Add stock'}
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
          <StockPicker
            onSelect={(species) => setStep({ kind: 'form', species })}
            footer={
              <button
                type="button"
                className="button button--ghost picker__custom"
                onClick={() => setStep({ kind: 'form', species: null })}
              >
                Add something else
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
                <StockThumb speciesId={step.species.id} kind={step.species.kind} />
                <span className="picker__text">
                  <span className="picker__name">{step.species.name}</span>
                  <span className="picker__sci">{step.species.scientific}</span>
                  <span className="picker__meta">
                    {ZONE_LABEL[step.species.zone]} · {tempRangeShort(step.species.tempC)}
                    {step.species.minGroup > 1 ? ` · groups of ${step.species.minGroup}+` : ''}
                  </span>
                </span>
              </div>
            )}
            {step.species && hasBetta && step.species.bettaCompat !== 'good' && (
              <p className={`stock-note stock-note--${step.species.bettaCompat}`} role="note">
                <BettaBadge species={step.species} /> {step.species.bettaReason}
              </p>
            )}
            <StockForm
              key={step.species?.id ?? 'custom'}
              initial={{
                name: step.species?.name ?? '',
                count: step.species?.minGroup ?? 1,
              }}
              nameHint={
                step.species
                  ? 'Rename it if you keep several groups of the same animal.'
                  : undefined
              }
              focusOn={step.species ? 'submit' : 'name'}
              submitLabel="Add to tank"
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
