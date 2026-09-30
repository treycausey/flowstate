export const events = new EventTarget()

export type ReadingsChangedDetail = { tankId: string }

export function emitReadingsChanged(tankId: string) {
  events.dispatchEvent(
    new CustomEvent<ReadingsChangedDetail>('readings-changed', { detail: { tankId } }),
  )
}

export function onReadingsChanged(cb: (tankId: string) => void) {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<ReadingsChangedDetail>
    cb(ce.detail.tankId)
  }
  events.addEventListener('readings-changed', handler)
  return () => events.removeEventListener('readings-changed', handler)
}

/** Plants or plant checks changed for a tank (add, edit, remove, check, import). */
export function emitPlantsChanged(tankId: string) {
  events.dispatchEvent(
    new CustomEvent<ReadingsChangedDetail>('plants-changed', { detail: { tankId } }),
  )
}

export function onPlantsChanged(cb: (tankId: string) => void) {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<ReadingsChangedDetail>
    cb(ce.detail.tankId)
  }
  events.addEventListener('plants-changed', handler)
  return () => events.removeEventListener('plants-changed', handler)
}
