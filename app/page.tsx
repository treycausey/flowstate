import HomeClient from '@/components/HomeClient'

export default function HomePage() {
  return (
    <main className="container stack" style={{ paddingTop: '1.25rem', paddingBottom: '2rem' }}>
      <header>
        <h1>Aquarium Water Tracker</h1>
        <p className="ink" style={{ color: 'var(--muted)' }}>
          Freshwater chemistry logging with minimalist charts. Local‑first, offline‑ready.
        </p>
      </header>
      <HomeClient />
    </main>
  )
}
