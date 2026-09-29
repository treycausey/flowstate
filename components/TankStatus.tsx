'use client'

import { useEffect, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import { listReadingsByTank } from '@/lib/idb'
import { onReadingsChanged } from '@/lib/events'
import { METRICS, METRIC_SHORT, type Metric, type Reading } from '@/lib/models'
import { formatMetric, unitFor } from '@/lib/format'
import { severity } from '@/lib/series'
import { tankStatus, type CycleStatus, type MetricStatus, type Trend } from '@/lib/status'

const CYCLE_LABEL: Record<CycleStatus, string> = {
  'not-started': 'Not started',
  cycling: 'Cycling',
  'nearly-cycled': 'Nearly cycled',
  cycled: 'Cycled',
}

const CYCLE_HINT: Record<CycleStatus, string> = {
  'not-started': 'Log both ammonia and nitrite to track the cycle.',
  cycling: 'Ammonia or nitrite is still above 0.',
  'nearly-cycled': 'Ammonia and nitrite are 0. Keep testing.',
  cycled: 'Three clean tests in a row and nitrate is present.',
}

const TREND_ARROW: Record<Exclude<Trend, null>, string> = { up: '↑', down: '↓', flat: '→' }
const TREND_WORD: Record<Exclude<Trend, null>, string> = {
  up: 'up',
  down: 'down',
  flat: 'unchanged',
}
const SEVERITY_TEXT = { caution: 'caution', high: 'out of range' } as const

function daysText(days: number | null) {
  if (days === null) return 'No tests yet'
  if (days === 0) return 'Last test: today'
  if (days === 1) return 'Last test: yesterday'
  return `Last test: ${days} days ago`
}

function MetricStatusRow({ metric, status }: { metric: Metric; status: MetricStatus }) {
  const { latest, previous, trend } = status
  if (!latest)
    return (
      <div className="status-metric">
        <dt>{METRIC_SHORT[metric]}</dt>
        <dd className="muted">
          <span aria-hidden="true">—</span>
          <span className="visually-hidden">not tested yet</span>
        </dd>
      </div>
    )
  const level = severity(metric, latest.value)
  return (
    <div className="status-metric">
      <dt>{METRIC_SHORT[metric]}</dt>
      <dd>
        <span className={level === 'ok' ? 'status-value' : `status-value flag flag--${level}`}>
          {formatMetric(metric, latest.value)}
          {unitFor(metric)}
          {level !== 'ok' && (
            <>
              <span aria-hidden="true">{level === 'high' ? ' ▲' : ' △'}</span>
              <span className="visually-hidden"> ({SEVERITY_TEXT[level]})</span>
            </>
          )}
        </span>
        {trend && previous && (
          <span className="status-trend muted">
            <span aria-hidden="true"> {TREND_ARROW[trend]}</span>
            <span className="visually-hidden">
              {' '}
              trend {TREND_WORD[trend]}
              {trend === 'flat' ? '' : ' from'} {formatMetric(metric, previous.value)}
            </span>
          </span>
        )}
      </dd>
    </div>
  )
}

/** Presentational card; `now` is injectable for tests. */
export function TankStatusView({ readings, now }: { readings: Reading[]; now?: Date }) {
  if (readings.length === 0) return <p className="muted">No tests yet. Log one above.</p>
  const status = tankStatus(readings, now)
  return (
    <div className="card status-card">
      <div className="status-head">
        <p className="status-cycle">
          <span className="muted">Nitrogen cycle: </span>
          <strong>{CYCLE_LABEL[status.cycle]}</strong>
        </p>
        <p className="muted small">{daysText(status.daysSinceLastTest)}</p>
      </div>
      <p className="muted small">{CYCLE_HINT[status.cycle]}</p>
      <dl className="status-metrics">
        {METRICS.map((m) => (
          <MetricStatusRow key={m} metric={m} status={status.metrics[m]} />
        ))}
      </dl>
    </div>
  )
}

/** Dashboard status for the active tank: cycle status, days since last test, latest values. */
export default function TankStatus() {
  const { activeTankId } = useTanks()
  // Tagged with its tank so a stale or unloaded list is never shown as "No tests yet"
  const [loaded, setLoaded] = useState<{ tankId: string; readings: Reading[] } | null>(null)
  const [failedTankId, setFailedTankId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!activeTankId) return
      try {
        const all = await listReadingsByTank(activeTankId)
        if (!mounted) return
        setFailedTankId(null)
        setLoaded({ tankId: activeTankId, readings: all })
      } catch (err) {
        console.error('Failed to load tank status', err)
        if (mounted) setFailedTankId(activeTankId)
      }
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

  if (!activeTankId) return null
  if (failedTankId === activeTankId)
    return (
      <p className="muted" role="alert">
        Couldn&apos;t load status.
      </p>
    )
  if (loaded?.tankId !== activeTankId) return null
  return <TankStatusView readings={loaded.readings} />
}
