import type { StockEvent, StockHealth } from '@/lib/models'
import { compareTs } from '@/lib/time'

/** Time of the latest whole-tank 'fed' event, or null. */
export function lastFedAt(events: readonly StockEvent[]): Date | null {
  let latest: string | null = null
  for (const e of events) {
    if (e.kind === 'fed' && (latest === null || e.ts > latest)) latest = e.ts
  }
  return latest ? new Date(latest) : null
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** True when the last feeding was on the same local calendar day as `now`. */
export function fedToday(events: readonly StockEvent[], now: Date): boolean {
  const last = lastFedAt(events)
  return last !== null && sameLocalDay(last, now)
}

export const HEALTH_TEXT: Record<StockHealth, string> = {
  ok: 'Looks well',
  concern: 'Some concern',
  sick: 'Sick',
}

export const HEALTH_TONE: Record<StockHealth, 'ok' | 'caution' | 'danger'> = {
  ok: 'ok',
  concern: 'caution',
  sick: 'danger',
}

/** Latest event that recorded a health state, per group. */
export function latestHealthByGroup(events: readonly StockEvent[]): Map<string, StockEvent> {
  const out = new Map<string, StockEvent>()
  for (const e of events.slice().sort(compareTs)) {
    if (e.stockId && e.health) out.set(e.stockId, e)
  }
  return out
}

/** Events for one group, newest first. */
export function eventsForGroup(events: readonly StockEvent[], groupId: string): StockEvent[] {
  return events
    .filter((e) => e.stockId === groupId)
    .sort(compareTs)
    .reverse()
}
