// Dev-only URL overrides for screenshots: ?tankPhase=dawn|day|dusk|night and ?tankDate=2026-12-31T23:59:30
// (local time, ticks forward from there). Both are ignored in production builds.

const PHASE_HOUR: Record<string, string> = {
  dawn: '06:40',
  day: '13:00',
  dusk: '19:15',
  night: '23:00',
}

/** A clock that starts at the overridden moment and keeps running, or null when no override applies. */
export function devClockFromSearch(search: string, real: Date = new Date()): (() => Date) | null {
  if (process.env.NODE_ENV === 'production') return null
  const q = new URLSearchParams(search)
  const dateParam = q.get('tankDate')
  const phase = q.get('tankPhase')
  let start: Date | null = null
  if (dateParam) {
    const d = new Date(dateParam)
    if (!Number.isNaN(d.getTime())) start = d
  } else if (phase && PHASE_HOUR[phase]) {
    const d = new Date(real)
    const [h, m] = PHASE_HOUR[phase].split(':').map(Number)
    d.setHours(h, m, 0, 0)
    start = d
  }
  if (!start) return null
  const offset = start.getTime() - real.getTime()
  return () => new Date(Date.now() + offset)
}
