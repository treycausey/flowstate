import type { StockEvent, StockGroup } from '../models'

/**
 * Apply an event to its group. Pure; the stores run it inside one transaction.
 * lost, rehomed and added change the count (never below 0). A group at 0 gets `removedAt`;
 * adding animals to a group that was at 0 brings it back. The stored event keeps the delta
 * that was really applied, so losing 5 from a group of 3 is recorded as -3.
 */
export function applyStockEvent(
  group: StockGroup,
  event: StockEvent,
): { group: StockGroup; event: StockEvent } {
  if (event.kind !== 'lost' && event.kind !== 'rehomed' && event.kind !== 'added') {
    return { group, event }
  }
  const raw = event.countDelta
  if (raw === null || raw === undefined || !Number.isInteger(raw) || raw === 0) {
    throw new Error('Enter how many animals.')
  }
  const signed = event.kind === 'added' ? Math.abs(raw) : -Math.abs(raw)
  const count = Math.max(0, group.count + signed)
  const applied = count - group.count
  const next: StockGroup = { ...group, count }
  if (count === 0) next.removedAt = event.ts
  else if (group.count === 0) next.removedAt = null
  return { group: next, event: { ...event, countDelta: applied } }
}
