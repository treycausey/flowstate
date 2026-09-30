'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { useTanks } from '@/components/TankProvider'
import { useTankReadings } from '@/lib/useTankReadings'
import { daysSinceLastTest, lastTestText } from '@/lib/status'

/** Panel header: tabs, serif wordmark, current tank and how long since the last test. */
export default function NavBar() {
  const pathname = usePathname() ?? '/'
  const { activeTankId, activeTank } = useTanks()
  const { readings } = useTankReadings(activeTankId)
  const q = activeTankId ? `?tankId=${encodeURIComponent(activeTankId)}` : ''
  const links = [
    { href: '/', label: 'Log', match: (p: string) => p === '/' },
    { href: `/tanks${q}`, label: 'Charts', match: (p: string) => p === '/tanks' },
    { href: '/plants', label: 'Plants', match: (p: string) => p.startsWith('/plants') },
    {
      href: `/tanks/report${q}`,
      label: 'Report',
      match: (p: string) => p.startsWith('/tanks/report'),
    },
    { href: '/settings', label: 'Settings', match: (p: string) => p.startsWith('/settings') },
  ]
  const clean = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/'
  const lastTest = readings ? lastTestText(daysSinceLastTest(readings)) : null

  return (
    <header className="panel-header site-header">
      <div className="panel-tabs">
        <nav aria-label="Main">
          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} aria-current={l.match(clean) ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeToggle />
      </div>
      <Link href="/" className="wordmark">
        Flowstate
      </Link>
      {activeTank && (
        <p className="panel-tank">
          <span className="panel-tank__name">{activeTank.name}</span>
          {lastTest && <span className="panel-tank__last">{lastTest}</span>}
          <span className="phase-moon" aria-hidden="true" />
        </p>
      )}
    </header>
  )
}
