'use client'

import { useEffect, useState } from 'react'
import { isTauri } from '@/lib/tauri'
import { getDbInfo, revealDb } from '@/lib/desktop'
import { exportDump, importDump, listTanks } from '@/lib/idb'
import { BackupFormatError } from '@/lib/backup'
import { downloadText } from '@/lib/export'
import { emitReadingsChanged } from '@/lib/events'
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

export default function SettingsClient() {
  const [db, setDb] = useState<DbInfo | null>(null)
  const [tauri, setTauri] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const { refresh } = useTanks()
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
      setTauri(isTauri())
      const info = await getDbInfo()
      if (info) setDb(info)
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
    const dump = await exportDump()
    const content = JSON.stringify(dump, null, 2)
    const date = new Date().toISOString().slice(0, 10)
    const defaultName = `flowstate-export-${date}.json`
    if (isTauri()) {
      try {
        const dialog = await import('@tauri-apps/api/dialog')
        const fs = await import('@tauri-apps/api/fs')
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
      text: `Exported ${dump.tanks.length} tank(s) and ${dump.readings.length} reading(s).`,
    })
  }

  const applyImport = async (text: string) => {
    try {
      const data = JSON.parse(text)
      const ok = window.confirm(
        'Import this backup? Tanks and readings with matching IDs will be overwritten; everything else is kept.',
      )
      if (!ok) return
      await importDump(data)
      try {
        await refresh()
        await refreshTankPrefs()
        for (const t of await listTanks()) emitReadingsChanged(t.id)
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
        text: `Imported ${data.tanks.length} tank(s) and ${data.readings.length} reading(s).`,
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
        const dialog = await import('@tauri-apps/api/dialog')
        const fs = await import('@tauri-apps/api/fs')
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
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => revealDb('folder')}
                >
                  Reveal in Finder/Explorer
                </button>
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
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => revealDb('file')}
                >
                  Open DB Path
                </button>
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

      <section>
        <h2 className="section-title">Backup & Migrate</h2>
        <p className="muted small">
          A JSON backup holds every tank, reading, and setting. Use it to move data between devices
          or into the desktop app.
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
