'use client'

import { useId, useState } from 'react'
import Modal from '@/components/plants/Modal'
import { deleteStock, updateStock } from '@/lib/idb'
import { emitStockChanged } from '@/lib/events'
import type { StockGroup } from '@/lib/models'
import StockForm, { type StockFormValues } from './StockForm'

type Props = {
  group: StockGroup
  onClose: () => void
  onSaved: () => void
  /** Called after the group and its history were deleted for good. */
  onDeleted: () => void
}

/** Change name, count, added date or note. Also the only place to delete for good. */
export default function EditStockModal({ group, onClose, onSaved, onDeleted }: Props) {
  const id = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (values: StockFormValues) => {
    setSaving(true)
    setError(null)
    try {
      await updateStock({
        ...group,
        name: values.name,
        count: values.count,
        addedAt: values.addedAt.toISOString(),
        note: values.note || null,
        // A group corrected back to 1 or more animals is in the tank again
        removedAt: group.count === 0 && values.count > 0 ? null : group.removedAt,
      })
      emitStockChanged(group.tankId)
      onSaved()
    } catch (err) {
      console.error('Failed to save stock', err)
      setError(`Couldn’t save: ${err instanceof Error ? err.message : String(err)}`)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (
      !window.confirm(
        `Delete “${group.name}” permanently? Its history goes too. This can’t be undone. To keep the history, use Remove instead.`,
      )
    )
      return
    setError(null)
    try {
      await deleteStock(group.id)
    } catch (err) {
      console.error('Failed to delete stock', err)
      setError(`Couldn’t delete: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    emitStockChanged(group.tankId)
    onDeleted()
  }

  return (
    <Modal labelledBy={`${id}-title`} onClose={onClose} initialFocus="input">
      <div className="stack">
        <div className="cluster plant-modal__head">
          <h3 id={`${id}-title`} style={{ margin: 0 }}>
            Edit stock
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
        <StockForm
          initial={{
            name: group.name,
            count: group.count,
            addedAt: new Date(group.addedAt),
            note: group.note ?? '',
          }}
          countLabel="Count now"
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
