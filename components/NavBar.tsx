'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import { useTanks } from '@/components/TankProvider'

export default function NavBar() {
  const pathname = usePathname() ?? '/'
  const { activeTankId } = useTanks()
  const q = activeTankId ? `?tankId=${encodeURIComponent(activeTankId)}` : ''
  const links = [
    { href: '/', label: 'Log', match: (p: string) => p === '/' },
    { href: `/tanks${q}`, label: 'Charts', match: (p: string) => p === '/tanks' },
    {
      href: `/tanks/report${q}`,
      label: 'Report',
      match: (p: string) => p.startsWith('/tanks/report'),
    },
    { href: '/settings', label: 'Settings', match: (p: string) => p.startsWith('/settings') },
  ]
  const clean = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/'

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand">
          <Logo size={24} title="" />
          <span>Flowstate</span>
        </Link>
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
    </header>
  )
}
