'use client'

import { useId, useState } from 'react'
import { deletePlant, updatePlant } from '@/lib/idb'
import { emitPlantsChanged } from '@/lib/events'
import type { Plant } from '@/lib/models'
import Modal from './Modal'
import PlantForm, { type PlantFormValues } from './PlantForm'

type Props = {
  plant: Plant
  onClose: () => void
  onSaved: () => void
  /** Called after the plant and its history were deleted for good. */
  onDeleted: () => void
}

/** Change name, placement, planted date or note. Also the only place to delete for good. */
export default function EditPlantModal({ plant, onClose, onSaved, onDeleted }: Props) {
  const id = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (values: PlantFormValues) => {
    setSaving(true)
    setError(null)
    try {
      await updatePlant({
        ...plant,
        name: values.name,
        placement: values.placement,
        plantedAt: values.plantedAt.toISOString(),
        note: values.note || null,
      })
      emitPlantsChanged(plant.tankId)
      onSaved()
    } catch (err) {
      console.error('Failed to save plant', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (
      !window.confirm(
        `Delete “${plant.name}” permanently? Its health history goes too. This can’t be undone. To keep the history, use Remove instead.`,
      )
    )
      return
    setError(null)
    try {
      await deletePlant(plant.id)
    } catch (err) {
      console.error('Failed to delete plant', err)
      setError(`Couldn’t delete: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    emitPlantsChanged(plant.tankId)
    onDeleted()
  }

  return (
    <Modal labelledBy={`${id}-title`} onClose={onClose} initialFocus="input">
      <div className="stack">
        <div className="cluster plant-modal__head">
          <h3 id={`${id}-title`} style={{ margin: 0 }}>
            Edit plant
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
        <PlantForm
          initial={{
            name: plant.name,
            placement: plant.placement,
            plantedAt: new Date(plant.plantedAt),
            note: plant.note ?? '',
          }}
          submitLabel="Save changes"
          saving={saving}
          error={error}
          onSubmit={save}
          onCancel={onClose}
          extraAction={
            <button
              type="button"
              className="button button--ghost button--danger plant-delete"
              onClick={remove}
            >
              Delete permanently
            </button>
          }
        />
      </div>
    </Modal>
  )
}
