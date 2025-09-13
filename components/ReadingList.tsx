"use client"

import { useEffect, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { deleteReading, listReadingsByTank, updateReading } from '@/lib/idb'
import { onReadingsChanged } from '@/lib/events'
import type { Reading } from '@/lib/models'
import { normalizeInput } from '@/lib/validation'
import { formatLocal } from '@/lib/time'

export default function ReadingList() {
  const { activeTankId } = useTanks()
  const [items, setItems] = useState<Reading[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!activeTankId) return setItems([])
      const all = await listReadingsByTank(activeTankId)
      if (mounted) setItems(all)
    }
    load()
    const off = onReadingsChanged((tankId) => {
      if (tankId === activeTankId) load()
    })
    return () => {
      mounted = false
      off()
    }
  }, [activeTankId])

  const onDelete = async (id: string) => {
    if (!confirm('Delete this reading?')) return
    await deleteReading(id)
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  const onEdit = async (r: Reading) => {
    const pH = Number(prompt('pH', String(r.pH)))
    const ammonia = Number(prompt('Ammonia ppm', String(r.ammonia)))
    const nitrite = Number(prompt('Nitrite ppm', String(r.nitrite)))
    const nitrate = Number(prompt('Nitrate ppm', String(r.nitrate)))
    const note = prompt('Note', r.note ?? '') || undefined
    const next: Reading = {
      ...r,
      pH: normalizeInput('pH', pH),
      ammonia: normalizeInput('ammonia', ammonia),
      nitrite: normalizeInput('nitrite', nitrite),
      nitrate: normalizeInput('nitrate', nitrate),
      note,
    }
    await updateReading(next)
    setItems((prev) => prev.map((x) => (x.id === r.id ? next : x)))
  }

  if (!activeTankId) return null

  return (
    <div>
      <h3 className="section-title" style={{ marginTop: 0 }}>Recent Readings</h3>
      {items.length === 0 ? (
        <p>No readings yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th align="left">Time</th>
              <th align="right">pH</th>
              <th align="right">NH3</th>
              <th align="right">NO2</th>
              <th align="right">NO3</th>
              <th align="left">Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{formatLocal(new Date(r.ts))}</td>
                <td align="right">{r.pH}</td>
                <td align="right">{r.ammonia}</td>
                <td align="right">{r.nitrite}</td>
                <td align="right">{r.nitrate}</td>
                <td>{r.note || ''}</td>
                <td>
                  <button className="button button--ghost" onClick={() => onEdit(r)}>Edit</button>{' '}
                  <button className="button button--ghost" onClick={() => onDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
