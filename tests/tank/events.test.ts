import { blurTank, createTankEvents, dropPellet, focusTank, tankEvents } from '@/lib/tank/events'

describe('tank events', () => {
  it('delivers typed payloads to subscribers and stops after unsubscribe', () => {
    const bus = createTankEvents()
    const seen: unknown[] = []
    const off = bus.on('tap', (p) => seen.push(p))
    bus.emit('tap', { x: 3, y: 4 })
    off()
    bus.emit('tap', { x: 5, y: 6 })
    expect(seen).toEqual([{ x: 3, y: 4 }])
  })

  it('lets a handler unsubscribe during emit without skipping others', () => {
    const bus = createTankEvents()
    const calls: string[] = []
    const off = bus.on('activity', () => {
      calls.push('a')
      off()
    })
    bus.on('activity', () => calls.push('b'))
    bus.emit('activity', {})
    bus.emit('activity', {})
    expect(calls).toEqual(['a', 'b', 'b'])
  })

  it('exposes helpers on the shared bus', () => {
    const seen: string[] = []
    const offs = [
      tankEvents.on('pellet', (p) => seen.push(`pellet:${p.at ? p.at.x : 'none'}`)),
      tankEvents.on('focus', (p) => seen.push(`focus:${p.x},${p.y}`)),
      tankEvents.on('blur', () => seen.push('blur')),
    ]
    dropPellet()
    dropPellet({ x: 9, y: 1 })
    focusTank(1, 2)
    blurTank()
    offs.forEach((off) => off())
    expect(seen).toEqual(['pellet:none', 'pellet:9', 'focus:1,2', 'blur'])
  })
})
