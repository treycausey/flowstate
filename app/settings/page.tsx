import SettingsClient from '@/components/SettingsClient'
import TankSwitcher from '@/components/TankSwitcher'

export const metadata = {
  title: 'Settings — Flowstate',
}

export default function SettingsPage() {
  return (
    <div className="stack page">
      <header>
        <h1 className="page-title">Settings</h1>
        <p className="ink" style={{ color: 'var(--muted)' }}>
          Manage storage and backups. Desktop builds use a local SQLite file; browser builds use
          IndexedDB.
        </p>
      </header>
      <section aria-labelledby="tanks-heading">
        <h2 id="tanks-heading" className="section-title">
          Tanks
        </h2>
        <TankSwitcher />
      </section>
      <SettingsClient />
    </div>
  )
}
