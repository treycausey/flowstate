"use client"

import { useEffect, useState } from 'react'
import { isTauri } from '@/lib/tauri'
import { getDbInfo, revealDb } from '@/lib/desktop'
import { exportDump, importDump } from '@/lib/idb'

type DbInfo = { dir: string; file: string }

export default function SettingsClient() {
  const [db, setDb] = useState<DbInfo | null>(null)
  const [tauri, setTauri] = useState(false)

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
      alert('Copied to clipboard')
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
        if (target) await fs.writeTextFile(target, content)
        return
      } catch {
        // fall through to web method
      }
    }
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImportJson = async () => {
    if (isTauri()) {
      try {
        const dialog = await import('@tauri-apps/api/dialog')
        const fs = await import('@tauri-apps/api/fs')
        const selected = await dialog.open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] })
        const path = Array.isArray(selected) ? selected[0] : selected
        if (path && typeof path === 'string') {
          const text = await fs.readTextFile(path)
          const data = JSON.parse(text)
          await importDump(data)
          alert('Import complete')
          return
        }
      } catch {
        // fall through to web method
      }
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      await importDump(data)
      alert('Import complete')
    }
    input.click()
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section>
        <h2 className="section-title">Storage</h2>
        {tauri ? (
          <div className="stack" style={{ gap: 8 }}>
            <div>
              <div>Data Folder:</div>
              <code style={{ display: 'block', wordBreak: 'break-all' }}>{db?.dir ?? '…'}</code>
              <div className="cluster" style={{ marginTop: 8 }}>
                <button onClick={() => revealDb('folder')}>Reveal in Finder/Explorer</button>
                <button onClick={() => copy(db?.dir)}>Copy Folder Path</button>
              </div>
            </div>
            <div>
              <div>Database File:</div>
              <code style={{ display: 'block', wordBreak: 'break-all' }}>{db?.file ?? '…'}</code>
              <div className="cluster" style={{ marginTop: 8 }}>
                <button onClick={() => revealDb('file')}>Open DB Path</button>
                <button onClick={() => copy(db?.file)}>Copy File Path</button>
              </div>
            </div>
          </div>
        ) : (
          <p>Running in browser/PWA. Data is stored in IndexedDB.</p>
        )}
      </section>

      <section>
        <h2 className="section-title">Backup & Migrate</h2>
        <div className="cluster">
          <button onClick={onExportJson}>Export JSON</button>
          <button onClick={onImportJson}>Import JSON</button>
        </div>
      </section>
    </div>
  )
}
