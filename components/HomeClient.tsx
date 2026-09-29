'use client'

import TankSwitcher from '@/components/TankSwitcher'
import QuickEntry from '@/components/QuickEntry'
import TankStatus from '@/components/TankStatus'
import ReadingList from '@/components/ReadingList'
import ReminderControls from '@/components/ReminderControls'
import NotificationsToggle from '@/components/NotificationsToggle'

export default function HomeClient() {
  return (
    <>
      <section aria-labelledby="tank-heading">
        <h2 id="tank-heading" className="section-title">
          Tank
        </h2>
        <TankSwitcher />
      </section>
      <section aria-labelledby="entry-heading">
        <h2 id="entry-heading" className="section-title">
          Log a test
        </h2>
        <QuickEntry />
      </section>
      <section aria-labelledby="status-heading">
        <h2 id="status-heading" className="section-title">
          Status
        </h2>
        <TankStatus />
      </section>
      <section>
        <ReadingList />
      </section>
      <section
        aria-labelledby="reminders-heading"
        className="stack"
        style={{ gap: 'var(--space-3)' }}
      >
        <h2 id="reminders-heading" className="section-title" style={{ marginBottom: 0 }}>
          Reminders
        </h2>
        <ReminderControls />
        <NotificationsToggle />
      </section>
    </>
  )
}
