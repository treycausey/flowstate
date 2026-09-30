// Food pellets shared by every creature in the tank. Pure: injected dt, no DOM.
//
// Coordinates are normalised to the viewport. A pellet sinks to the substrate (floorY), rests there and
// fades out after LANDED_SECONDS if nothing eats it.

export type Pellet = {
  id: number
  x: number
  y: number
  age: number
  alpha: number
  /** Seconds spent on the substrate (set once it has landed). */
  landed?: number
}

/** Seconds an uneaten pellet stays on the substrate before it is gone. */
export const LANDED_SECONDS = 20
/** Fade-out over the last part of that time. */
const FADE_SECONDS = 4
/** Sink speed in viewport heights per second multiplied by the aspect ratio (as the betta's pellets did). */
const SINK = 0.045
export const MAX_PELLETS = 12

export class PelletField {
  pellets: Pellet[] = []
  private nextId = 1
  floorY = 0.9
  aspect = 1.6

  add(x: number, y: number) {
    this.pellets.push({ id: this.nextId++, x, y, age: 0, alpha: 1 })
    if (this.pellets.length > MAX_PELLETS) this.pellets.shift()
  }

  remove(p: Pellet) {
    this.pellets = this.pellets.filter((q) => q !== p)
  }

  /** A pellet that has reached the substrate. */
  isLanded(p: Pellet) {
    return p.landed !== undefined
  }

  step(dt: number) {
    for (const p of this.pellets) {
      p.age += dt
      if (p.landed === undefined) {
        p.y = Math.min(this.floorY, p.y + SINK * this.aspect * dt)
        if (p.y >= this.floorY - 1e-9) p.landed = 0
      } else {
        p.landed += dt
        p.alpha = Math.min(1, Math.max(0, (LANDED_SECONDS - p.landed) / FADE_SECONDS))
      }
    }
    this.pellets = this.pellets.filter((p) => p.alpha > 0)
  }
}
