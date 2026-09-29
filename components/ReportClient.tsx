'use client'

import { useEffect, useMemo, useState } from 'react'
import { listReadingsByTank } from '@/lib/idb'
import { downloadText, readingsToCsv, safeFilePart } from '@/lib/export'
import { filterReadingsByDays, summarizeOutOfRange } from '@/lib/report'
import { readingsToSeries } from '@/lib/series'
import { METRICS, METRIC_LABEL, type Reading } from '@/lib/models'
import { formatLocal } from '@/lib/time'
import { useTanks } from '@/components/TankProvider'
import TankFromQuery from '@/components/TankFromQuery'
import SmallMultiples from '@/components/charts/SmallMultiples'

type Range = '30' | '90' | 'all'
const RANGE_LABEL: Record<Range, string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  all: 'All time',
}
const dateOnly = { dateStyle: 'medium' } as const

export default function ReportClient() {
  const { activeTank, activeTanks, setActiveTankId, loaded } = useTanks()
  const [readings, setReadings] = useState<Reading[]>([])
  const [range, setRange] = useState<Range>('30')
  // Fixed at mount so the report window doesn't drift between renders
  const [now] = useState(() => new Date())

  useEffect(() => {
    if (!activeTank) return
    let mounted = true
    listReadingsByTank(activeTank.id).then((rs) => mounted && setReadings(rs))
    return () => {
      mounted = false
    }
  }, [activeTank])

  const { filtered, outOfRange, series, xDomain, from } = useMemo(() => {
    const days = range === 'all' ? 'all' : Number(range)
    const filtered = filterReadingsByDays(readings, days, now)
    const from =
      days === 'all'
        ? filtered.length
          ? new Date(filtered[0].ts)
          : now
        : new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return {
      filtered,
      outOfRange: summarizeOutOfRange(filtered),
      series: readingsToSeries(filtered),
      // Start the axis at the first reading so a sparse range isn't squeezed to one edge;
      // the header still states the full reporting period
      xDomain: filtered.length
        ? ([new Date(filtered[0].ts).getTime(), now.getTime()] as [number, number])
        : undefined,
      from,
    }
  }, [readings, range, now])

  if (!loaded) return null
  if (!activeTank) return <p>No tanks yet.</p>

  const date = now.toISOString().slice(0, 10)
  const base = `flowstate-${safeFilePart(activeTank.name)}`
  const exportRange = () =>
    downloadText(
      `${base}-${range === 'all' ? 'all' : `${range}d`}-${date}.csv`,
      readingsToCsv(activeTank, filtered),
      'text/csv',
    )
  const exportAll = () =>
    downloadText(`${base}-all-${date}.csv`, readingsToCsv(activeTank, readings), 'text/csv')

  return (
    <>
      <TankFromQuery />
      <div className="cluster no-print">
        {activeTanks.length > 1 && (
          <label className="inline">
            Tank
            <select value={activeTank.id} onChange={(e) => setActiveTankId(e.target.value)}>
              {activeTanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="inline">
          Range
          <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <option key={r} value={r}>
                {RANGE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <button type="button" className="button button--ghost" onClick={exportRange}>
          Export CSV ({RANGE_LABEL[range].toLowerCase()})
        </button>
        {range !== 'all' && (
          <button type="button" className="button button--ghost" onClick={exportAll}>
            Export all readings
          </button>
        )}
      </div>

      <header className="report-head">
        <h1 className="page-title">{activeTank.name} — water report</h1>
        <p className="muted" style={{ margin: 0 }}>
          {RANGE_LABEL[range]}: {formatLocal(from, undefined, dateOnly)} –{' '}
          {formatLocal(now, undefined, dateOnly)} · {filtered.length} reading
          {filtered.length === 1 ? '' : 's'} · generated {formatLocal(now)}
        </p>
      </header>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="section-title">
          Out-of-range summary
        </h2>
        <table className="summary">
          <thead>
            <tr>
              <th scope="col" className="left">
                Metric
              </th>
              <th scope="col" className="num">
                Out of range
              </th>
              <th scope="col" className="num">
                Readings
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m}>
                <th scope="row" className="left">
                  {METRIC_LABEL[m]}
                </th>
                <td className={`num${outOfRange[m] ? ' flag flag--high' : ''}`}>{outOfRange[m]}</td>
                <td className="num">{filtered.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="section-title">
          Trends
        </h2>
        {filtered.length === 0 ? (
          <p className="muted">No readings in this range.</p>
        ) : (
          <SmallMultiples series={series} xDomain={xDomain} chartHeight={110} />
        )}
      </section>
    </>
  )
}
