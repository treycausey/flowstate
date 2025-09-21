import SettingsClient from '@/components/SettingsClient'

export const metadata = {
  title: 'Settings — Flowstate',
}

export default function SettingsPage() {
  return (
    <main className="container stack" style={{ paddingTop: '1.25rem', paddingBottom: '2rem' }}>
      <header>
        <h1 className="section-title">Settings</h1>
        <p className="ink" style={{ color: 'var(--muted)' }}>
          Manage storage and backups. Desktop builds use a local SQLite file; browser builds use IndexedDB.
        </p>
      </header>
      <SettingsClient />
    </main>
  )
}

