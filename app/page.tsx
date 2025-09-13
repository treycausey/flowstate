import HomeClient from '@/components/HomeClient'
import Logo from '@/components/Logo'

export default function HomePage() {
  return (
    <main className="container stack" style={{ paddingTop: '1.25rem', paddingBottom: '2rem' }}>
      <header>
        <div className="cluster" style={{ alignItems: 'center', gap: '0.6rem' }}>
          <Logo size={28} />
          <h1 style={{ margin: 0 }}>Flowstate</h1>
        </div>
        <p className="ink" style={{ color: 'var(--muted)' }}>
          Freshwater chemistry logging with minimalist charts. Local‑first, offline‑ready.
        </p>
      </header>
      <HomeClient />
    </main>
  )
}
