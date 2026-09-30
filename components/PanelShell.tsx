'use client'

import { usePathname } from 'next/navigation'

/** Routes whose content needs the wide panel (charts and the printable report). */
export function isWidePanelRoute(pathname: string) {
  const clean = pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/'
  return clean === '/tanks' || clean.startsWith('/tanks/report')
}

/**
 * The one frosted panel every page lives in. The wide layout is flagged with
 * `data-wide="true"` (CSS widens it to min(58vw, 900px) on desktop).
 */
export default function PanelShell({ children }: { children: React.ReactNode }) {
  const wide = isWidePanelRoute(usePathname() ?? '/')
  return (
    <main className="app-panel" data-wide={wide ? 'true' : 'false'}>
      {children}
    </main>
  )
}
