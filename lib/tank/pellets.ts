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
/** A lone betta's pellets stop within its reach, fade over 8 s and at most 6 exist. */
const BETTA_ONLY_SECONDS = 8
const BETTA_ONLY_MAX = 6
/** Sink speed in viewport heights per second multiplied by the aspect ratio (as the betta's pellets did). */
const SINK = 0.045
export const MAX_PELLETS = 12

export class PelletField {
  pellets: Pellet[] = []
  private nextId = 1
  floorY = 0.9
  aspect = 1.6
  /**
   * Betta-only tank: the floor is the fish's reach floor, pellets fade over 8 s once they stop and the
   * field holds 6. With other stock the floor is the substrate and food stays 20 s.
   */
  bettaOnly = false

  private get rest() {
    return this.bettaOnly ? BETTA_ONLY_SECONDS : LANDED_SECONDS
  }
  private get fade() {
    return this.bettaOnly ? BETTA_ONLY_SECONDS : FADE_SECONDS
  }

  add(x: number, y: number) {
    this.pellets.push({ id: this.nextId++, x, y, age: 0, alpha: 1 })
    if (this.pellets.length > (this.bettaOnly ? BETTA_ONLY_MAX : MAX_PELLETS)) this.pellets.shift()
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
        p.alpha = Math.min(1, Math.max(0, (this.rest - p.landed) / this.fade))
      }
    }
    this.pellets = this.pellets.filter((p) => p.alpha > 0)
  }
}
