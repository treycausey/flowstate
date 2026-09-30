// Everything that swims, crawls or clings in the tank: the betta (when there is one), the recorded
// stock, and the food they share. Pure: injected dt, seeded RNG, no DOM.

import {
  BettaSim,
  largestFreeRect,
  mulberry32,
  type BettaConfig,
  type BettaFrame,
  type Rect,
} from './betta'
import { CorySim, KuhliSim } from './bottom'
import { CrawlerSim } from './crawlers'
import type { CreatureFrame, Group, StockContext, World } from './creature'
import { PelletField, type Pellet } from './pellets'
import { SchoolSim } from './school'
import { spriteWidth, type SpeciesProfile } from './species'
import { MAX_CREATURES, planKey, planStock, type StockEntry, type StockPlan } from './stock'
import type { Mood } from './waterState'

export type LivestockConfig = BettaConfig & {
  /** Normalised y of the substrate line. */
  floorY: number
  /** Plate uv to normalised view coordinates. */
  plateToView: (u: number, v: number) => [number, number]
}

export type LivestockFrame = {
  /** The betta's own frame (null when the stock has no betta). */
  betta: BettaFrame | null
  /** Every other creature, including the honey gourami. */
  creatures: CreatureFrame[]
  pellets: readonly Pellet[]
}

const DEFAULT_CONFIG: LivestockConfig = {
  aspect: 1.6,
  fishWidth: 0.19,
  exclusion: null,
  restSpot: { x: 0.74, y: 0.3 },
  floorY: 0.9,
  plateToView: (u, v) => [u, v],
}

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

type Solo = { key: string; profile: SpeciesProfile; sim: BettaSim }

export class Livestock {
  private cfg: LivestockConfig
  private seed: number
  private ctx: StockContext = { night: false, dusk: false, mood: 'healthy' }
  private entries: readonly StockEntry[]
  private cap = MAX_CREATURES
  private plan: StockPlan
  private key = ''
  private rng: () => number
  readonly pellets = new PelletField()
  betta: BettaSim | null = null
  private solos: Solo[] = []
  private groups: Group[] = []
  private groupKeys = new Map<Group, string>()

  constructor(seed = 1, config: Partial<LivestockConfig> = {}, stock: readonly StockEntry[] = []) {
    this.seed = seed
    this.cfg = { ...DEFAULT_CONFIG, ...config }
    this.rng = mulberry32(seed ^ 0x9e3779b9)
    this.entries = stock
    this.plan = planStock(stock, this.cap)
    this.build()
  }

  // ---- stock ----

  setStock(entries: readonly StockEntry[]) {
    this.entries = entries
    this.replan()
  }

  /** Lower the number drawn when the frame rate drops (and raise it back). */
  setBudget(maxCreatures: number) {
    const cap = Math.max(1, Math.round(maxCreatures))
    if (cap === this.cap) return
    this.cap = cap
    this.replan()
  }

  private replan() {
    const next = planStock(this.entries, this.cap)
    const key = planKey(next)
    this.plan = next
    if (key !== this.key) this.build()
  }

  get drawn() {
    return this.plan.total
  }

  get hasBetta() {
    return this.plan.betta
  }

  private world(): World {
    const c = this.cfg
    return {
      aspect: c.aspect,
      fishWidth: c.fishWidth,
      exclusion: c.exclusion,
      free: largestFreeRect(c.exclusion),
      floorY: c.floorY,
      plateToView: c.plateToView,
    }
  }

  private bettaConfig(fishWidth: number): BettaConfig {
    const c = this.cfg
    return { aspect: c.aspect, fishWidth, exclusion: c.exclusion, restSpot: c.restSpot }
  }

  /** (Re)build the sims for the current plan, keeping what is unchanged. */
  private build() {
    const plan = this.plan
    this.key = planKey(plan)
    this.pellets.floorY = this.cfg.floorY
    this.pellets.aspect = this.cfg.aspect

    if (plan.betta && !this.betta) {
      const b = new BettaSim(this.seed, this.bettaConfig(this.cfg.fishWidth))
      b.usePelletField(this.pellets)
      b.setContext({ night: this.ctx.night, mood: this.ctx.mood })
      this.betta = b
    } else if (!plan.betta) {
      this.betta = null
    }

    const world = this.world()
    const oldGroups = new Map([...this.groupKeys].map(([g, k]) => [k, g]))
    this.groupKeys = new Map()
    const oldSolos = new Map(this.solos.map((s) => [s.key, s]))
    this.groups = []
    this.solos = []
    const schools = plan.groups.filter((g) => g.profile.model === 'school')
    let laneIndex = 0
    for (const g of plan.groups) {
      const seed = this.seed * 7919 + hash(g.profile.id)
      if (g.profile.model === 'solitary') {
        for (let i = 0; i < g.render; i++) {
          const key = `${g.profile.id}-${i}`
          let solo = oldSolos.get(key)
          if (!solo) {
            const sim = new BettaSim(
              seed + i,
              this.bettaConfig(spriteWidth(g.profile, this.cfg.fishWidth)),
            )
            sim.setTraits({ speed: 0.6, flare: false, rest: false, inspect: false })
            sim.usePelletField(this.pellets)
            solo = { key, profile: g.profile, sim }
          }
          this.solos.push(solo)
        }
        continue
      }
      const reuseKey = g.profile.id + ':' + g.render
      let group = oldGroups.get(reuseKey)
      if (!group) {
        if (g.profile.model === 'school') {
          const n = Math.max(1, schools.length)
          const lane: [number, number] = [laneIndex / n, (laneIndex + 1) / n]
          group = new SchoolSim(g.profile, g.render, seed, this.pellets, lane)
        } else if (g.profile.model === 'bottom') {
          group = new CorySim(g.profile, g.render, seed, this.pellets)
        } else if (g.profile.model === 'kuhli') {
          group = new KuhliSim(g.profile, g.render, seed, this.pellets)
        } else {
          group = new CrawlerSim(g.profile, g.render, seed, this.pellets)
        }
      }
      if (g.profile.model === 'school') laneIndex++
      group.setContext(this.ctx)
      group.configure(world)
      this.groups.push(group)
      this.groupKeys.set(group, reuseKey)
    }
    for (const s of this.solos) {
      s.sim.configure(this.bettaConfig(spriteWidth(s.profile, this.cfg.fishWidth)))
      s.sim.setContext({ night: this.ctx.night, mood: this.ctx.mood })
    }
  }

  // ---- config ----

  configure(partial: Partial<LivestockConfig>) {
    this.cfg = { ...this.cfg, ...partial }
    this.pellets.floorY = this.cfg.floorY
    this.pellets.aspect = this.cfg.aspect
    this.betta?.configure(this.bettaConfig(this.cfg.fishWidth))
    for (const s of this.solos) {
      s.sim.configure(this.bettaConfig(spriteWidth(s.profile, this.cfg.fishWidth)))
    }
    const world = this.world()
    for (const g of this.groups) g.configure(world)
  }

  setContext(ctx: { night: boolean; mood: Mood; dusk?: boolean }) {
    this.ctx = { night: ctx.night, dusk: ctx.dusk ?? false, mood: ctx.mood }
    this.betta?.setContext({ night: ctx.night, mood: ctx.mood })
    for (const s of this.solos) s.sim.setContext({ night: ctx.night, mood: ctx.mood })
    for (const g of this.groups) g.setContext(this.ctx)
  }

  // ---- input events ----

  activity() {
    this.betta?.activity()
    for (const s of this.solos) s.sim.activity()
  }

  /** Several pellets (more for a bigger tank, at most five) sinking from near the surface. */
  dropPellet(at?: { x: number; y: number }) {
    this.activity()
    // One pellet for a lone betta; more as the stock grows.
    const count = this.plan.total <= 1 ? 1 : Math.min(5, Math.ceil(this.plan.total / 3))
    const free = largestFreeRect(this.cfg.exclusion)
    let origin = at
    if (!origin) {
      if (this.betta) origin = this.betta.pelletSpot()
      else
        origin = {
          x: free.x0 + (free.x1 - free.x0) * (0.25 + 0.5 * this.rng()),
          y: 0.08,
        }
    } else if (this.betta) {
      origin = this.betta.pelletSpot(at)
    }
    const w = (0.07 * this.cfg.fishWidth) / 0.19
    for (let i = 0; i < count; i++) {
      const dx = i === 0 ? 0 : (this.rng() * 2 - 1) * w
      const dy = i === 0 ? 0 : this.rng() * 0.05
      const x = Math.min(free.x1, Math.max(free.x0, origin.x + dx))
      this.pellets.add(x, Math.min(0.2, Math.max(0.03, origin.y + dy)))
    }
  }

  flare() {
    this.betta?.flare()
  }
  celebrate() {
    this.betta?.celebrate()
  }
  lookAt(at: { x: number; y: number }) {
    this.betta?.lookAt(at)
  }
  focusAt(at: { x: number; y: number }) {
    this.betta?.focusAt(at)
  }
  blur() {
    this.betta?.blur()
  }
  triggerInspect() {
    this.betta?.triggerInspect()
  }

  // ---- stepping ----

  step(dt: number): LivestockFrame {
    this.pellets.step(Math.min(dt, 0.25))
    this.betta?.step(dt)
    for (const s of this.solos) s.sim.step(dt)
    for (const g of this.groups) g.step(dt)
    return this.frame()
  }

  frame(): LivestockFrame {
    const creatures: CreatureFrame[] = []
    for (const s of this.solos) creatures.push(soloFrame(s, s.sim.frame()))
    for (const g of this.groups) creatures.push(...g.frames())
    return {
      betta: this.betta ? this.betta.frame() : null,
      creatures,
      pellets: this.pellets.pellets,
    }
  }

  /** Free-water rect the swimmers share (for tests). */
  freeRect(): Rect {
    return largestFreeRect(this.cfg.exclusion)
  }

  groupsForTest(): readonly Group[] {
    return this.groups
  }
}

function soloFrame(s: Solo, f: BettaFrame): CreatureFrame {
  return {
    key: s.key,
    species: s.profile.id,
    x: f.x,
    y: f.y,
    z: f.z,
    scale: f.scale,
    fit: 1,
    heading: f.heading,
    facing: f.facing,
    turnProgress: f.turnProgress,
    pitch: f.pitch,
    speed: f.speed,
    tailPhase: f.tailBeatPhase,
    pecPhase: f.pectoralPhase,
    wave: Math.min(1.4, 0.2 + f.speed / 0.04),
    gulp: f.gulp,
    alpha: 1,
    plateSpace: false,
    shadow: false,
    soft: false,
  }
}
