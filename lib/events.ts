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
