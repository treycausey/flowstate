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
            href={activeTankId ? `/tanks/${activeTankId}` : '#'}
          >
            View Charts
          </Link>
          <Link
            className="button button--ghost"
            aria-disabled={!activeTankId}
            href={activeTankId ? `/tanks/${activeTankId}/report` : '#'}
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
    </>
  )
}
