import { formatMetric, unitFor } from '@/lib/format'
import type { Diagnosis } from '@/lib/plants/health'
import { formatLocal } from '@/lib/time'

const METRIC_NAME = {
  pH: 'pH',
  ammonia: 'Ammonia',
  nitrite: 'Nitrite',
  nitrate: 'Nitrate',
} as const

/** "Nitrate tested 0 ppm on Sep 29": the water test that backs a suggested cause. */
export function evidenceText(evidence: NonNullable<Diagnosis['evidence']>) {
  const date = formatLocal(new Date(evidence.ts), undefined, { month: 'short', day: 'numeric' })
  return `${METRIC_NAME[evidence.metric]} tested ${formatMetric(evidence.metric, evidence.value)}${unitFor(evidence.metric)} on ${date}`
}

type Props = {
  plantName: string
  diagnoses: Diagnosis[]
  onDismiss: () => void
}

/** Calm, dismissible list of likely causes shown after a health check with symptoms. */
export default function DiagnosisCard({ plantName, diagnoses, onDismiss }: Props) {
  return (
    <section className="diagnosis" aria-labelledby="diagnosis-title">
      <header className="diagnosis__head">
        <h3 id="diagnosis-title">What may be going on</h3>
        <button type="button" className="button button--ghost button--small" onClick={onDismiss}>
          Dismiss
        </button>
      </header>
      <p className="muted diagnosis__lead">
        Likely causes for {plantName}, most likely first. Plants are hard to read, so treat these as
        starting points.
      </p>
      <ol className="diagnosis__list">
        {diagnoses.map((d) => (
          <li key={d.id}>
            <p className="diagnosis__title">
              {d.title}{' '}
              <span className={`diagnosis__tag diagnosis__tag--${d.likelihood}`}>
                {d.likelihood === 'likely' ? 'Likely' : 'Possible'}
              </span>
            </p>
            <p>{d.explanation}</p>
            {d.evidence && <p className="diagnosis__evidence">{evidenceText(d.evidence)}</p>}
            <p className="diagnosis__try">
              <strong>Try:</strong> {d.suggestion}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
