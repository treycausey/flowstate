"use client"

import { useMemo, useState } from 'react'
import SmallMultiples from '@/components/charts/SmallMultiples'
import { generateSeries } from '@/lib/sim'

export default function SimChartsClient() {
  const [days, setDays] = useState(60)
  const [ppd, setPpd] = useState(1)
  const [seed, setSeed] = useState(42)

  const series = useMemo(() => generateSeries({ days, pointsPerDay: ppd, seed }), [days, ppd, seed])

  return (
    <div className="stack">
      <div className="cluster">
        <label>
          Days
          <input type="number" value={days} min={7} max={365} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
        <label>
          Points/day
          <input type="number" value={ppd} min={1} max={12} onChange={(e) => setPpd(Number(e.target.value))} />
        </label>
        <label>
          Seed
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
        </label>
      </div>
      <SmallMultiples series={series} />
    </div>
  )
}

