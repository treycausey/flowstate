'use client'

import { useCallback } from 'react'
import { useTanks } from '@/components/TankProvider'
import { archiveTank, createTank, renameTank } from '@/lib/idb'

export default function TankSwitcher() {
  const { tanks, activeTankId, setActiveTankId, refresh } = useTanks()

  const onCreate = useCallback(async () => {
    const name = typeof window !== 'undefined' ? window.prompt('New tank name') : null
    if (!name) return
    await createTank(name)
    await refresh()
  }, [refresh])

  const onRename = useCallback(async () => {
    const current = tanks.find((t) => t.id === activeTankId)
    if (!current) return
    const name = typeof window !== 'undefined' ? window.prompt('Rename tank', current.name) : null
    if (!name) return
    await renameTank(current.id, name)
    await refresh()
  }, [activeTankId, refresh, tanks])

  const onArchive = useCallback(async () => {
    const current = tanks.find((t) => t.id === activeTankId)
    if (!current) return
    const ok = typeof window !== 'undefined' ? window.confirm('Archive this tank?') : false
    if (!ok) return
    await archiveTank(current.id)
    await refresh()
  }, [activeTankId, refresh, tanks])

  if (tanks.length === 0) {
    return (
      <div>
        <p>No tanks yet.</p>
        <button onClick={onCreate}>Create First Tank</button>
      </div>
    )
  }

  return (
    <div className="cluster">
      <label htmlFor="tank-select">Tank:</label>
      <select
        id="tank-select"
        value={activeTankId ?? ''}
        onChange={(e) => setActiveTankId(e.target.value)}
      >
        {tanks
          .filter((t) => !t.archivedAt)
          .map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
      </select>
      <button className="button" onClick={onCreate}>
        New
      </button>
      <button className="button button--ghost" onClick={onRename} disabled={!activeTankId}>
        Rename
      </button>
      <button className="button button--ghost" onClick={onArchive} disabled={!activeTankId}>
        Archive
      </button>
    </div>
  )
}
