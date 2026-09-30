'use client'

import TankSwitcher from '@/components/TankSwitcher'
import QuickEntry from '@/components/QuickEntry'
import TankStatus from '@/components/TankStatus'
import ReadingList from '@/components/ReadingList'
import ReminderControls from '@/components/ReminderControls'
import NotificationsToggle from '@/components/NotificationsToggle'
import { useTanks } from '@/components/TankProvider'

export default function HomeClient() {
  const { activeTanks, loaded } = useTanks()
  // With exactly one tank the panel header already names it, so tank management drops to the
  // bottom. With none (first run) or several, the switcher stays at the top where it is needed.
  const switcherOnTop = loaded && activeTanks.length !== 1
  const switcher = (
    <section aria-labelledby="tank-heading">
      <h2
        id="tank-heading"
        className={switcherOnTop ? 'section-title visually-hidden' : 'section-title'}
      >
        Tank
      </h2>
      <TankSwitcher />
    </section>
  )
  return (
    <>
      {switcherOnTop && switcher}
      <section aria-labelledby="entry-heading">
        <h2 id="entry-heading" className="section-title">
          Log a test
        </h2>
        <QuickEntry />
      </section>
      <section aria-labelledby="status-heading">
        <h2 id="status-heading" className="section-title visually-hidden">
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
      {!switcherOnTop && switcher}
    </>
  )
}
