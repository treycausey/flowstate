'use client'

import { useEffect, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { listReadingsByTank } from '@/lib/idb'
import SmallMultiples from './SmallMultiples'
import { rollingAverage } from '@/lib/series'

export default function TankSeries() {
  const { activeTankId } = useTanks()
  const [series, setSeries] = useState({
    pH: [] as { ts: string; value: number }[],
    ammonia: [] as { ts: string; value: number }[],
    nitrite: [] as { ts: string; value: number }[],
    nitrate: [] as { ts: string; value: number }[],
  })
  const [useRolling, setUseRolling] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!activeTankId) return
      const r = await listReadingsByTank(activeTankId)
      const base = {
        pH: r.map((x) => ({ ts: x.ts, value: x.pH })),
        ammonia: r.map((x) => ({ ts: x.ts, value: x.ammonia })),
        nitrite: r.map((x) => ({ ts: x.ts, value: x.nitrite })),
        nitrate: r.map((x) => ({ ts: x.ts, value: x.nitrate })),
      }
      setSeries(
        useRolling
          ? {
              pH: rollingAverage(base.pH, 7),
              ammonia: rollingAverage(base.ammonia, 7),
              nitrite: rollingAverage(base.nitrite, 7),
              nitrate: rollingAverage(base.nitrate, 7),
            }
          : base,
      )
    }
    load()
  }, [activeTankId, useRolling])

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={{ fontSize: 12 }}>
        <input
          type="checkbox"
          checked={useRolling}
          onChange={(e) => setUseRolling(e.target.checked)}
        />{' '}
        7‑day rolling average
      </label>
      <SmallMultiples series={series} valueMode={useRolling ? 'rolling' : 'latest'} />
    </div>
  )
}
