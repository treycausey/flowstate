import { addStockEvent } from '@/lib/idb'
import { emitStockChanged } from '@/lib/events'
import type { StockEvent } from '@/lib/models'
import { dropPellet } from '@/lib/tank/events'

/**
 * Record that the tank was fed now: one whole-tank 'fed' event. Also drops a pellet into the
 * living tank scene. The scene call is fire-and-forget and a no-op when the scene is off.
 */
export async function recordFed(tankId: string, now: Date = new Date()): Promise<StockEvent> {
  const event = await addStockEvent({
    tankId,
    stockId: null,
    ts: now.toISOString(),
    kind: 'fed',
  })
  emitStockChanged(tankId)
  dropPellet()
  return event
}
