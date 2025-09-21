"use client"

import Link from 'next/link'
import TankSwitcher from '@/components/TankSwitcher'
import QuickEntry from '@/components/QuickEntry'
import ReadingList from '@/components/ReadingList'
import ReminderControls from '@/components/ReminderControls'
import NotificationsToggle from '@/components/NotificationsToggle'
import { useTanks } from '@/components/TankProvider'

export default function HomeClient() {
  const { activeTankId } = useTanks()
  return (
    <>
      <section>
        <h2 className="section-title">Tanks</h2>
        <TankSwitcher />
        <div className="cluster" style={{ marginTop: '0.5rem' }}>
          <Link
            className="button"
            aria-disabled={!activeTankId}
            href={activeTankId ? `/tanks?tankId=${activeTankId}` : '/tanks'}
          >
            View Charts
          </Link>
          <Link
            className="button button--ghost"
            aria-disabled={!activeTankId}
            href={activeTankId ? `/tanks/report?tankId=${activeTankId}` : '/tanks/report'}
          >
            Report
          </Link>
        </div>
      </section>
      <section>
        <h2 className="section-title">Quick Entry</h2>
        <QuickEntry />
      </section>
      <section>
        <ReadingList />
      </section>
      <section>
        <h2 className="section-title">Reminders</h2>
        <ReminderControls />
        <div style={{ marginTop: '0.5rem' }}>
          <NotificationsToggle />
        </div>
      </section>
      <section>
        <h2 className="section-title">Settings</h2>
        <div className="cluster">
          <Link className="button button--ghost" href="/settings">
            Open Settings
          </Link>
        </div>
      </section>
    </>
  )
}
