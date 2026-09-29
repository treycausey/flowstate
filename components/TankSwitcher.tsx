'use client'

import { useCallback } from 'react'
import { useTanks } from '@/components/TankProvider'
import { archiveTank, createTank, renameTank } from '@/lib/idb'

function askName(message: string, current?: string) {
  const name = window.prompt(message, current)?.trim()
  return name ? name : null
}

export default function TankSwitcher() {
  const { activeTanks, activeTank, setActiveTankId, refresh, loaded } = useTanks()

  const onCreate = useCallback(async () => {
    const name = askName('New tank name')
    if (!name) return
    const tank = await createTank(name)
    setActiveTankId(tank.id)
    await refresh()
  }, [refresh, setActiveTankId])

  const onRename = useCallback(async () => {
    if (!activeTank) return
    const name = askName('Rename tank', activeTank.name)
    if (!name || name === activeTank.name) return
    await renameTank(activeTank.id, name)
    await refresh()
  }, [activeTank, refresh])

  const onArchive = useCallback(async () => {
    if (!activeTank) return
    const ok = window.confirm(
      `Archive “${activeTank.name}”? It will be hidden from the tank list. Its readings are kept.`,
    )
    if (!ok) return
    await archiveTank(activeTank.id)
    await refresh()
  }, [activeTank, refresh])

  if (!loaded) return null

  if (activeTanks.length === 0) {
    return (
      <div className="cluster">
        <p style={{ margin: 0 }}>No tanks yet.</p>
        <button type="button" className="button" onClick={onCreate}>
          Create first tank
        </button>
      </div>
    )
  }

  return (
    <div className="cluster">
      <label htmlFor="tank-select" className="visually-hidden">
        Tank
      </label>
      <select
        id="tank-select"
        className="tank-select"
        value={activeTank?.id ?? ''}
        onChange={(e) => setActiveTankId(e.target.value)}
      >
        {activeTanks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="cluster" style={{ gap: 'var(--space-2)' }}>
        <button type="button" className="button button--ghost" onClick={onCreate}>
          New
        </button>
        <button type="button" className="button button--ghost" onClick={onRename}>
          Rename
        </button>
        <button type="button" className="button button--ghost" onClick={onArchive}>
          Archive
        </button>
      </div>
    </div>
  )
}
