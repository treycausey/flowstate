import { FramePacer } from '@/lib/tank/pacing'

// Regression: in half-rate mode the time of skipped frames used to be dropped, so the simulation
// ran at half speed (the idle "look at you" egg took minutes on a slow display).
describe('FramePacer', () => {
  it('keeps simulation time equal to real time after dropping to half rate', () => {
    const pacer = new FramePacer()
    let now = 0
    let stepped = 0
    const frame = 1 / 25 // 25 fps: slower than 45, so it drops to half rate
    for (let i = 0; i < 25 * 10; i++) {
      now += frame * 1000
      stepped += pacer.next(frame, now).step
    }
    expect(pacer.level).toBe('half')
    expect(stepped).toBeGreaterThan(9.7)
    expect(stepped).toBeLessThanOrEqual(10.01)
  })

  it('stays at full rate on a fast display', () => {
    const pacer = new FramePacer()
    let now = 0
    for (let i = 0; i < 200; i++) {
      now += 16.7
      expect(pacer.next(1 / 60, now).draw).toBe(true)
    }
    expect(pacer.level).toBe('full')
  })
})
