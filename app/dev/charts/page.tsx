import DevOnlyNotice from '@/components/DevOnlyNotice'
import SimChartsClient from '@/components/dev/SimChartsClient'

export const dynamic = 'force-static'

export default function DevChartsPage() {
  if (process.env.NODE_ENV === 'production') return <DevOnlyNotice />
  return (
    <div className="container stack" style={{ paddingTop: '1.25rem', paddingBottom: '2rem' }}>
      <header>
        <h1>Simulated Charts</h1>
        <p className="ink" style={{ color: 'var(--muted)' }}>
          Generates deterministic sample data for pH, NH3, NO2, and NO3 to preview chart behavior.
        </p>
      </header>
      <SimChartsClient />
    </div>
  )
}
