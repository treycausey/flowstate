'use client'

import { useEffect, useState } from 'react'
import { listReadingsByTank, listTanks } from '@/lib/idb'
import { readingsToCsv } from '@/lib/export'
import { exportDump, importDump } from '@/lib/idb'
import { filterReadingsByDays, summarizeOutOfRange } from '@/lib/report'
import type { Tank, Reading } from '@/lib/models'

export default function ReportClient({ initialTankId }: { initialTankId?: string }) {
  const [tank, setTank] = useState<Tank | null>(null)
  const [readings, setReadings] = useState<Reading[]>([])
  const [range, setRange] = useState<'30' | '90' | 'all'>('30')

  useEffect(() => {
    const load = async () => {
      const tanks = await listTanks()
      if (tanks.length === 0) return
      const t = initialTankId ? (tanks.find((x) => x.id === initialTankId) ?? tanks[0]) : tanks[0]
      setTank(t)
      const rs = await listReadingsByTank(t.id)
      setReadings(rs)
    }
    load()
  }, [initialTankId])

  if (!tank) return null

  const onExport = () => {
    const csv = readingsToCsv(tank, readings)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().slice(0, 10)
    a.download = `aquarium-${tank.name}-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = filterReadingsByDays(readings, range === 'all' ? 'all' : Number(range))
  const outOfRange = summarizeOutOfRange(filtered)

  const onExportJson = async () => {
    const dump = await exportDump()
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `flowstate-export-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImportJson = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      await importDump(data)
      // reload local state
      const tanks = await listTanks()
      const t = tanks[0]
      setTank(t)
      const rs = await listReadingsByTank(t.id)
      setReadings(rs)
      alert('Import complete')
    }
    input.click()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          Range
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            style={{ marginLeft: 6 }}
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
        <button onClick={onExport}>Export CSV</button>
        <button onClick={onExportJson}>Export JSON</button>
        <button onClick={onImportJson}>Import JSON</button>
      </div>
      <section style={{ marginTop: 16 }}>
        <h2>Summary</h2>
        <p>Readings in range: {filtered.length}</p>
        <ul>
          <li>pH out‑of‑range: {outOfRange.pH}</li>
          <li>Ammonia out‑of‑range: {outOfRange.ammonia}</li>
          <li>Nitrite out‑of‑range: {outOfRange.nitrite}</li>
          <li>Nitrate out‑of‑range: {outOfRange.nitrate}</li>
        </ul>
      </section>
    </>
  )
}
