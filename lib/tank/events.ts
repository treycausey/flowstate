// Tiny typed event bus between the app (panel, forms) and the tank scene. No dependencies.
// All coordinates are client pixels (the same space as getBoundingClientRect / MouseEvent.clientX).

export type Point = { x: number; y: number }

export type TankEventMap = {
  /** Drop a food pellet. Without `at` it falls from near the surface. */
  pellet: { at?: Point }
  /** A tap on the tank area that was not on the panel. */
  tap: Point
  /** The user is focused on something at this point (an input field); the betta drifts to look. */
  focus: Point
  blur: Record<string, never>
  /** Any user activity; resets the idle timer for the inspect easter egg. */
  activity: Record<string, never>
}

type Handler<K extends keyof TankEventMap> = (payload: TankEventMap[K]) => void

export type TankEventBus = {
  on<K extends keyof TankEventMap>(type: K, handler: Handler<K>): () => void
  emit<K extends keyof TankEventMap>(type: K, payload: TankEventMap[K]): void
}

export function createTankEvents(): TankEventBus {
  const handlers = new Map<keyof TankEventMap, Set<Handler<keyof TankEventMap>>>()
  return {
    on(type, handler) {
      let set = handlers.get(type)
      if (!set) handlers.set(type, (set = new Set()))
      set.add(handler as Handler<keyof TankEventMap>)
      return () => {
        set.delete(handler as Handler<keyof TankEventMap>)
      }
    },
    emit(type, payload) {
      for (const handler of [...(handlers.get(type) ?? [])]) handler(payload)
    },
  }
}

export const tankEvents = createTankEvents()

export const dropPellet = (at?: Point) => tankEvents.emit('pellet', { at })
export const tapTank = (x: number, y: number) => tankEvents.emit('tap', { x, y })
export const focusTank = (x: number, y: number) => tankEvents.emit('focus', { x, y })
export const blurTank = () => tankEvents.emit('blur', {})
export const reportActivity = () => tankEvents.emit('activity', {})
