// Adaptive frame pacing for the tank loop. Pure.
//
// Runs at the display rate unless frames arrive slower than ~45 fps, then draws every other frame
// (half rate) and retries full rate after 15 s. Time that passes on skipped frames is carried into
// the next drawn frame, so the simulation always runs in real time.

export type PaceLevel = 'full' | 'half'

const MAX_STEP = 0.25

export class FramePacer {
  level: PaceLevel = 'full'
  private deltas: number[] = []
  private halfSince = 0
  private skip = false
  private pending = 0

  /** `deltaSeconds` since the previous frame, `nowMs` the frame timestamp. */
  next(deltaSeconds: number, nowMs: number): { draw: boolean; step: number } {
    this.deltas.push(deltaSeconds * 1000)
    if (this.deltas.length > 40) this.deltas.shift()
    if (this.deltas.length >= 30) {
      const avg = this.deltas.reduce((a, b) => a + b, 0) / this.deltas.length
      if (this.level === 'full' && avg > 22) {
        this.level = 'half'
        this.halfSince = nowMs
        this.deltas.length = 0
      } else if (this.level === 'half' && nowMs - this.halfSince > 15_000) {
        this.level = 'full'
        this.deltas.length = 0
      }
    }
    this.skip = !this.skip
    this.pending += deltaSeconds
    if (this.level === 'half' && this.skip) return { draw: false, step: 0 }
    const step = Math.min(MAX_STEP, this.pending)
    this.pending = 0
    return { draw: true, step }
  }
}
