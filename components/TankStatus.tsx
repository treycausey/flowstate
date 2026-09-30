'use client'

import { useTanks } from '@/components/TankProvider'
import { useTankReadings } from '@/lib/useTankReadings'
import { METRICS, METRIC_SHORT, type Metric, type Reading } from '@/lib/models'
import { formatMetric, unitFor } from '@/lib/format'
import { severity } from '@/lib/series'
import {
  metricHistory,
  tankStatus,
  type CycleStatus,
  type MetricStatus,
  type Trend,
} from '@/lib/status'
import Sparkline from '@/components/charts/Sparkline'
import PlantsStatusLine from '@/components/plants/PlantsStatusLine'

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
        <span className="status-label">{METRIC_SHORT[metric]}</span>
        <span className="status-value muted">
          <span aria-hidden="true">—</span>
          <span className="visually-hidden">not tested yet</span>
        </span>
      </div>
    )
  const level = severity(metric, latest.value)
  return (
    <div className="status-metric">
      <span className="status-label">{METRIC_SHORT[metric]}</span>
      <span className="status-value-wrap">
        <span className={level === 'ok' ? 'status-value' : `status-value flag flag--${level}`}>
          {formatMetric(metric, latest.value)}
          <span className="visually-hidden">{unitFor(metric)}</span>
          {level !== 'ok' && (
            <>
              <span aria-hidden="true">{level === 'high' ? ' ▲' : ' △'}</span>
              <span className="visually-hidden"> ({SEVERITY_TEXT[level]})</span>
            </>
          )}
        </span>
        {trend && previous && (
          <span className="status-trend muted">
            <span className="visually-hidden">
              {' '}
              trend {TREND_WORD[trend]}
              {trend === 'flat' ? '' : ' from'} {formatMetric(metric, previous.value)}
            </span>
          </span>
        )}
      </span>
    </div>
  )
}

/** Presentational block; `now` is injectable for tests. */
export function TankStatusView({ readings, now }: { readings: Reading[]; now?: Date }) {
  if (readings.length === 0) return <p className="muted">No tests yet. Log one above.</p>
  const status = tankStatus(readings, now)
  return (
    <div className="status-card">
      <div className="status-line">
        <p className="status-cycle">
          <span className="visually-hidden">Nitrogen cycle: </span>
          <strong>{CYCLE_LABEL[status.cycle]}</strong>
        </p>
        {METRICS.map((m) => (
          <MetricStatusRow key={m} metric={m} status={status.metrics[m]} />
        ))}
      </div>
      <div className="sparklines">
        {METRICS.map((m) => {
          const latest = status.metrics[m].latest
          const level = latest ? severity(m, latest.value) : 'ok'
          return (
            <div key={m} className="spark-cell" data-label={METRIC_SHORT[m]}>
              <Sparkline values={metricHistory(readings, m)} label={METRIC_SHORT[m]} tone={level} />
            </div>
          )
        })}
      </div>
      <p className="status-hint">{CYCLE_HINT[status.cycle]}</p>
      <p className="visually-hidden">{daysText(status.daysSinceLastTest)}</p>
    </div>
  )
}

/** Dashboard status for the active tank: cycle status, days since last test, latest values. */
export default function TankStatus() {
  const { activeTankId } = useTanks()
  const { readings, failed } = useTankReadings(activeTankId)

  if (!activeTankId) return null
  if (failed)
    return (
      <p className="muted" role="alert">
        Couldn&apos;t load status.
      </p>
    )
  if (!readings) return null
  return (
    <>
      <TankStatusView readings={readings} />
      <PlantsStatusLine tankId={activeTankId} />
    </>
  )
}
