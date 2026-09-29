'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { listReadingsByTank } from '@/lib/idb'
import { onReadingsChanged } from '@/lib/events'
import { filterReadingsByDays } from '@/lib/report'
import { readingsToSeries, rollingAverage, type MetricSeries } from '@/lib/series'
import { METRICS, type Reading } from '@/lib/models'
import SmallMultiples from './SmallMultiples'

type Range = '30' | '90' | 'all'

export default function TankSeries() {
  const { activeTankId } = useTanks()
  const [readings, setReadings] = useState<Reading[]>([])
  const [range, setRange] = useState<Range>('90')
  const [useRolling, setUseRolling] = useState(false)

  useEffect(() => {
    if (!activeTankId) return
    let mounted = true
    const load = async () => {
      const r = await listReadingsByTank(activeTankId)
      if (mounted) setReadings(r)
    }
    load()
    const off = onReadingsChanged((id) => id === activeTankId && load())
    return () => {
      mounted = false
      off()
    }
  }, [activeTankId])

  const { raw, shown, xDomain } = useMemo(() => {
    const now = new Date()
    const inRange = filterReadingsByDays(readings, range === 'all' ? 'all' : Number(range), now)
    const raw = readingsToSeries(inRange)
    const shown: MetricSeries = useRolling
      ? (Object.fromEntries(METRICS.map((m) => [m, rollingAverage(raw[m], 7)])) as MetricSeries)
      : raw
    // Run the axis up to "now" so gaps since the last test are visible; don't pad
    // before the first reading, so a new tank's few points aren't squeezed to one edge
    const xDomain: [number, number] | undefined = inRange.length
      ? [
          new Date(inRange[0].ts).getTime(),
          Math.max(now.getTime(), new Date(inRange[inRange.length - 1].ts).getTime()),
        ]
      : undefined
    return { raw, shown, xDomain }
  }, [readings, range, useRolling])

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="cluster">
        <label className="inline">
          Range
          <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
        <label className="inline checkbox">
          <input
            type="checkbox"
            checked={useRolling}
            onChange={(e) => setUseRolling(e.target.checked)}
          />
          7‑day rolling average
        </label>
      </div>
      {readings.length === 0 ? (
        <p className="muted">No readings yet for this tank.</p>
      ) : (
        <SmallMultiples
          series={shown}
          anomalySource={raw}
          xDomain={xDomain}
          valueMode={useRolling ? 'rolling' : 'latest'}
        />
      )}
    </div>
  )
}
