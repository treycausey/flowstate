'use client'

import { useEffect, useState } from 'react'
import { isIos, isTauri } from '@/lib/tauri'
import { getBuildInfo, getDbInfo, revealDb } from '@/lib/desktop'
import type { BuildInfo } from '@/lib/desktop'
import { exportDump, importDump, listTanks } from '@/lib/idb'
import { BackupFormatError } from '@/lib/backup'
import { errorText } from '@/lib/errors'
import { downloadText } from '@/lib/export'
import { emitPlantsChanged, emitReadingsChanged, emitStockChanged } from '@/lib/events'
import VolumeField from '@/components/stock/VolumeField'
import { useTanks } from '@/components/TankProvider'
import {
  DEFAULT_PREFS,
  loadTankPrefs,
  onTankPrefsChanged,
  refreshTankPrefs,
  saveTankPrefs,
  type TankPrefs,
} from '@/lib/tank/prefs'

type DbInfo = { dir: string; file: string }

/** " and 3 plant(s)" when a backup carries plants, else nothing. */
function plantsSuffix(plants: unknown) {
  return Array.isArray(plants) && plants.length > 0 ? ` and ${plants.length} plant(s)` : ''
}

/** " and 3 stock group(s)" when a backup carries stock, else nothing. */
function stockSuffix(stock: unknown) {
  return Array.isArray(stock) && stock.length > 0 ? ` and ${stock.length} stock group(s)` : ''
}

export default function SettingsClient() {
  const [db, setDb] = useState<DbInfo | null>(null)
  const [tauri, setTauri] = useState(false)
  const [ios, setIos] = useState(false)
  const [build, setBuild] = useState<BuildInfo | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const { refresh, activeTank } = useTanks()
  const [prefs, setPrefs] = useState<TankPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    loadTankPrefs()
      .then(setPrefs)
      .catch((err) => console.error('Failed to load tank settings', err))
    return onTankPrefsChanged(setPrefs)
  }, [])

  const updatePrefs = async (patch: Partial<TankPrefs>) => {
    const previous = prefs
    setPrefs((current) => ({ ...current, ...patch }))
    try {
      await saveTankPrefs(patch)
    } catch (err) {
      console.error('Failed to save tank settings', err)
      // Roll back only the keys this change touched.
      setPrefs((current) => {
        const next = { ...current }
        for (const key of Object.keys(patch) as (keyof TankPrefs)[]) {
          ;(next as Record<string, unknown>)[key] = previous[key]
        }
        return next
      })
      setMessage({ kind: 'error', text: 'Couldn’t save that setting.' })
    }
  }

  useEffect(() => {
    ;(async () => {
      // Prefer runtime detection first so UI shows even if API import fails
      const inTauri = isTauri()
      setTauri(inTauri)
      setIos(isIos())
      if (!inTauri) return
      const info = await getDbInfo()
      if (info) setDb(info)
      setBuild(await getBuildInfo())
    })()
  }, [])

  const copy = async (text?: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setMessage({ kind: 'ok', text: 'Copied to clipboard.' })
    } catch {
      // ignore
    }
  }

  const onExportJson = async () => {
    let dump: Awaited<ReturnType<typeof exportDump>>
    try {
      dump = await exportDump()
    } catch (err) {
      console.error('Failed to read data for export', err)
      setMessage({ kind: 'error', text: `Export failed: ${errorText(err)}.` })
      return
    }
    const content = JSON.stringify(dump, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    const defaultName = `flowstate-export-${date}.json`
    if (isTauri()) {
      try {
        const dialog = await import('@tauri-apps/plugin-dialog')
        const fs = await import('@tauri-apps/plugin-fs')
        const target = await dialog.save({ defaultPath: defaultName })
        if (target) {
          await fs.writeTextFile(target, content)
          setMessage({ kind: 'ok', text: `Backup saved to ${target}` })
        }
        return
      } catch {
        // fall through to web method
      }
    }
    downloadText(defaultName, content, 'application/json')
    setMessage({
      kind: 'ok',
      text: `Exported ${dump.tanks.length} tank(s) and ${dump.readings.length} reading(s)${plantsSuffix(dump.plants)}${stockSuffix(dump.stock)}.`,
    })
  }

  const applyImport = async (text: string) => {
    try {
      const data = JSON.parse(text)
      const ok = window.confirm(
        'Import this backup? Tanks, readings, plants and stock with matching IDs will be overwritten; everything else is kept.',
      )
      if (!ok) return
      await importDump(data)
      try {
        await refresh()
        await refreshTankPrefs()
        for (const t of await listTanks()) {
          emitReadingsChanged(t.id)
          emitPlantsChanged(t.id)
          emitStockChanged(t.id)
        }
      } catch (err) {
        console.error('Refresh after import failed', err)
        setMessage({
          kind: 'error',
          text: 'Imported, but couldn’t refresh — reload the app.',
        })
        return
      }
      setMessage({
        kind: 'ok',
        text: `Imported ${data.tanks.length} tank(s) and ${data.readings.length} reading(s)${plantsSuffix(data.plants)}${stockSuffix(data.stock)}.`,
      })
    } catch (e) {
      const reason =
        e instanceof SyntaxError
          ? 'the file is not valid JSON'
          : e instanceof BackupFormatError
            ? e.message
            : String(e)
      setMessage({ kind: 'error', text: `Import failed: ${reason}. Nothing was changed.` })
    }
  }

  const onImportJson = async () => {
    if (isTauri()) {
      try {
        const dialog = await import('@tauri-apps/plugin-dialog')
        const fs = await import('@tauri-apps/plugin-fs')
        const selected = await dialog.open({
          multiple: false,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        const path = Array.isArray(selected) ? selected[0] : selected
        if (path && typeof path === 'string') {
          await applyImport(await fs.readTextFile(path))
        }
        return
      } catch {
        // fall through to web method
      }
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) await applyImport(await file.text())
    }
    input.click()
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      {activeTank && (
        <section aria-labelledby="tank-heading">
          <h2 id="tank-heading" className="section-title">
            Tank
          </h2>
          <p className="muted small">{activeTank.name}</p>
          <VolumeField key={activeTank.id} tank={activeTank} />
        </section>
      )}

      <section aria-labelledby="living-tank-heading">
        <h2 id="living-tank-heading" className="section-title">
          Living tank
        </h2>
        <div className="stack" style={{ gap: 12 }}>
          <label className="inline checkbox">
            <input
              type="checkbox"
              checked={prefs.livingTank}
              onChange={(e) => updatePrefs({ livingTank: e.target.checked })}
            />
            <span>Show living tank</span>
          </label>
          <div className="field field--row">
            <label htmlFor="tank-hemisphere">Hemisphere</label>
            <select
              id="tank-hemisphere"
              value={prefs.hemisphere}
              onChange={(e) =>
                updatePrefs({ hemisphere: e.target.value === 'south' ? 'south' : 'north' })
              }
            >
              <option value="north">Northern</option>
              <option value="south">Southern</option>
            </select>
          </div>
          <p className="muted small">
            The tank follows the time of day, the season, and your latest water tests. It also
            follows your system’s Reduce Motion setting. Turn it off to save battery: the page then
            shows a still picture and never starts WebGL.
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Storage</h2>
        {tauri ? (
          <div className="stack" style={{ gap: 8 }}>
            <div>
              <div>Data Folder:</div>
              <code style={{ display: 'block', wordBreak: 'break-all' }}>{db?.dir ?? '…'}</code>
              <div className="cluster" style={{ marginTop: 8 }}>
                {!ios && (
                  <button type="button" className="button button--ghost" onClick={() => revealDb()}>
                    Reveal in Finder/Explorer
                  </button>
                )}
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => copy(db?.dir)}
                >
                  Copy Folder Path
                </button>
              </div>
            </div>
            <div>
              <div>Database File:</div>
              <code style={{ display: 'block', wordBreak: 'break-all' }}>{db?.file ?? '…'}</code>
              <div className="cluster" style={{ marginTop: 8 }}>
                {!ios && (
                  <button type="button" className="button button--ghost" onClick={() => revealDb()}>
                    Open DB Path
                  </button>
                )}
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => copy(db?.file)}
                >
                  Copy File Path
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p>
            Your data is stored only in this browser (IndexedDB) on this device. Clearing site data
            or uninstalling the app deletes it, so export a backup now and then.
          </p>
        )}
      </section>

      {build && (
        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="section-title">
            About
          </h2>
          <p className="muted small">
            Build {build.build} · {build.hash}
          </p>
        </section>
      )}

      <section>
        <h2 className="section-title">Backup & Migrate</h2>
        <p className="muted small">
          A JSON backup holds every tank, reading, plant, plant check, stock group, stock event and
          setting. Use it to move data between devices or into the desktop app.
        </p>
        <div className="cluster">
          <button type="button" className="button" onClick={onExportJson}>
            Export backup (JSON)
          </button>
          <button type="button" className="button button--ghost" onClick={onImportJson}>
            Import backup…
          </button>
        </div>
        <div role="status" aria-live="polite" style={{ marginTop: 'var(--space-3)' }}>
          {message && (
            <span className={message.kind === 'error' ? 'danger' : undefined}>{message.text}</span>
          )}
        </div>
      </section>
    </div>
  )
}
