// WebGL2 renderer for the living tank. One canvas, premultiplied alpha, no dependencies.
// Layers back to front: plate (with the baked prop patches composited into it) + grade + caustics + shafts,
// far motes, bubbles, betta, pellets, near motes, glass dust, foreground stems.

import type { BettaFrame } from './betta'
import type { CreatureFrame } from './creature'
import type { Pellet } from './pellets'
import { BETTA_LENGTH_CM, SPECIES } from './species'
import type { Environment, Phase } from './environment'
import { computeGrade, type Grade } from './grade'
import { PATCH_PROPS, patchLayers, patchMeta, patchTargets, type PatchLayer } from './patches'
import { BACKGROUND_FRAG, FULLSCREEN_VERT } from './shaders/background'
import { AXIS_Y, BETTA_FRAG, BETTA_VERT } from './shaders/betta'
import { CREATURE_FRAG, CREATURE_VERT } from './shaders/creature'
import {
  BUBBLE_FRAG,
  BUBBLE_VERT,
  COVER_FRAG,
  DISC_FRAG,
  DISC_VERT,
  DUST_FRAG,
  PARTICLE_FRAG,
  PARTICLE_VERT,
} from './shaders/sprites'
import type { WaterState } from './waterState'

const ASSET_BASE = '/tank'
const PLATE_ASPECT = 2560 / 1707
const CROSSFADE_SECONDS = 6
const PARTICLE_COUNT = 200
const BUBBLE_SLOTS = 18
const BURST_SLOTS = 64
const BURST_SECONDS = 13
const SHIMMER_SECONDS = 4.5
/** Seconds for the nest and leaf patches to fade in or out. */
const PATCH_FADE_SECONDS = 2.5
/** Seconds for a patch that just finished loading to fade in, so it never pops. */
const PATCH_LOAD_FADE_SECONDS = 1.5
/** Surface bob of the floating props: at most this many CSS pixels up and down, and a wobble across. */
const BOB_PX = 1.5
const WOBBLE_PX = 0.8
/** The plates are cropped by this factor so parallax never shows an edge. */
const PLATE_CROP = 0.975

export type RenderInput = {
  /** Seconds. Drives every animation; pass a fixed value for a deterministic frame. */
  time: number
  env: Environment
  water: WaterState
  /** The betta's frame; null when the stock has no betta. */
  betta: BettaFrame | null
  /** Every other creature, drawn with the creature shader. */
  creatures?: readonly CreatureFrame[]
  /** Food pellets (defaults to the betta's own). */
  pellets?: readonly Pellet[]
  /** Sprite width of the betta in view widths. */
  fishWidth: number
  /** Latest tap ripple, if any. Coordinates are normalised view space, t0 is in `time` seconds. */
  ripple: { x: number; y: number; t0: number } | null
  /** Snap slow fades (bubble nest) to their target; used for single deterministic frames. */
  instant?: boolean
  /** Dev only: draw each creature's final coverage as white on black (the plate is black). */
  debugAlpha?: boolean
}

type Tex = { tex: WebGLTexture; w: number; h: number }
type PatchSlot = { layer: PatchLayer; tex: Tex; alpha: number; shift: [number, number] }

class Prog {
  readonly program: WebGLProgram
  private locs = new Map<string, WebGLUniformLocation | null>()
  constructor(
    private gl: WebGL2RenderingContext,
    vs: string,
    fs: string,
    label: string,
  ) {
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)
      if (!sh) throw new Error(`tank: cannot create shader (${label})`)
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh)
        gl.deleteShader(sh)
        throw new Error(
          `tank: ${label} ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader failed: ${log}`,
        )
      }
      return sh
    }
    const v = compile(gl.VERTEX_SHADER, vs)
    const f = compile(gl.FRAGMENT_SHADER, fs)
    const p = gl.createProgram()
    if (!p) throw new Error(`tank: cannot create program (${label})`)
    gl.attachShader(p, v)
    gl.attachShader(p, f)
    gl.linkProgram(p)
    gl.deleteShader(v)
    gl.deleteShader(f)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`tank: ${label} link failed: ${gl.getProgramInfoLog(p)}`)
    }
    this.program = p
  }
  use() {
    this.gl.useProgram(this.program)
  }
  private loc(name: string) {
    let l = this.locs.get(name)
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name)
      this.locs.set(name, l)
    }
    return l
  }
  f1(name: string, a: number) {
    this.gl.uniform1f(this.loc(name), a)
  }
  f2(name: string, a: number, b: number) {
    this.gl.uniform2f(this.loc(name), a, b)
  }
  f3(name: string, a: number, b: number, c: number) {
    this.gl.uniform3f(this.loc(name), a, b, c)
  }
  v3(name: string, v: readonly number[]) {
    this.gl.uniform3f(this.loc(name), v[0], v[1], v[2])
  }
  i1(name: string, a: number) {
    this.gl.uniform1i(this.loc(name), a)
  }
  v4(name: string, v: Float32Array) {
    this.gl.uniform4fv(this.loc(name), v)
  }
  v1array(name: string, v: Float32Array) {
    this.gl.uniform1fv(this.loc(name), v)
  }
  v2array(name: string, v: Float32Array) {
    this.gl.uniform2fv(this.loc(name), v)
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Betta sprite width in view widths at the focal plane. Real macro feel comes from depth, so the base
 * is small: about 0.19 of the width on desktop, and about a third of the hero band on phones.
 */
export function fishWidthFor(viewWidth: number): number {
  if (viewWidth < 520) return 0.34
  if (viewWidth < 900) return lerp(0.34, 0.19, (viewWidth - 520) / 380)
  return 0.19
}

export function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class TankRenderer {
  private gl!: WebGL2RenderingContext
  private lost = false
  private width = 1
  private height = 1
  private aspect = 1
  private dpr = 1
  private focal: [number, number] = [0.5, 0.5]
  private pointer: [number, number] = [0, 0] // -1..1
  private parallaxPx = 8

  private progs!: {
    bg: Prog
    betta: Prog
    creature: Prog
    cover: Prog
    disc: Prog
    particle: Prog
    bubble: Prog
    dust: Prog
  }
  private vao!: {
    fullscreen: WebGLVertexArrayObject
    betta: WebGLVertexArrayObject
    bettaCount: number
    creature: WebGLVertexArrayObject
    creatureCount: number
    disc: WebGLVertexArrayObject
    particles: WebGLVertexArrayObject
    bubbles: WebGLVertexArrayObject
  }
  private buffers: WebGLBuffer[] = []

  // Assets.
  private plates = new Map<Phase, { sm: Tex | null; lg: Tex | null; loading: Set<string> }>()
  private images = new Map<string, Tex>()
  private requested = new Set<string>()
  private phaseCur: Phase | null = null
  private fade: { to: Phase; t0: number | null } | null = null
  private onAsset: () => void = () => {}

  // Smoothed opacity of the floating props, and when each patch texture first became usable.
  private patchAlpha: Record<'nest' | 'leaf', number> = { nest: 0, leaf: 0 }
  private patchReadyAt = new Map<string, number>()
  private blankTex: WebGLTexture | null = null
  private swimScratch: CreatureFrame[] = []
  private rectBuf = new Float32Array(32)
  private alphaBuf = new Float32Array(8)
  private shiftBuf = new Float32Array(16)
  private burstT0: number | null = null
  private shimmerT0: number | null = null
  private lastTime = 0
  private floatBuf = new Float32Array(12)
  private poseUniform = new Float32Array([
    0.933,
    0.464,
    879 / 1200,
    1, // cruise
    0.935,
    0.475,
    879 / 1200,
    1, // flare
    0.923,
    0.39,
    626 / 1200,
    0.86, // clamped
  ])

  static create(canvas: HTMLCanvasElement, onAssetLoaded: () => void): TankRenderer | null {
    if (typeof WebGL2RenderingContext === 'undefined') return null
    const r = new TankRenderer(canvas, onAssetLoaded)
    return r.initGL() ? r : null
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    onAssetLoaded: () => void,
  ) {
    this.onAsset = onAssetLoaded
    canvas.addEventListener('webglcontextlost', this.handleLost)
    canvas.addEventListener('webglcontextrestored', this.handleRestored)
  }

  private handleLost = (e: Event) => {
    e.preventDefault()
    this.lost = true
  }

  private handleRestored = () => {
    this.plates.clear()
    this.images.clear()
    this.patchReadyAt.clear()
    this.buffers = []
    if (this.initGL()) {
      this.lost = false
      const again = [...this.requested]
      this.requested.clear()
      if (this.phaseCur) void this.loadPlate(this.phaseCur)
      if (this.fade) {
        // A crossfade was running: reload the incoming plate and restart the fade timer.
        this.fade.t0 = null
        void this.loadPlate(this.fade.to)
      }
      for (const key of again) if (!key.startsWith('plate')) void this.loadImage(key)
      this.onAsset()
    }
  }

  get isLost() {
    return this.lost
  }

  private initGL(): boolean {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return false
    this.gl = gl
    try {
      this.progs = {
        bg: new Prog(gl, FULLSCREEN_VERT, BACKGROUND_FRAG, 'background'),
        betta: new Prog(gl, BETTA_VERT, BETTA_FRAG, 'betta'),
        creature: new Prog(gl, CREATURE_VERT, CREATURE_FRAG, 'creature'),
        cover: new Prog(gl, FULLSCREEN_VERT, COVER_FRAG, 'cover'),
        disc: new Prog(gl, DISC_VERT, DISC_FRAG, 'disc'),
        particle: new Prog(gl, PARTICLE_VERT, PARTICLE_FRAG, 'particle'),
        bubble: new Prog(gl, BUBBLE_VERT, BUBBLE_FRAG, 'bubble'),
        dust: new Prog(gl, FULLSCREEN_VERT, DUST_FRAG, 'dust'),
      }
    } catch (err) {
      console.error(err)
      return false
    }
    this.buildGeometry()
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    return true
  }

  private buffer(data: ArrayBufferView, target: number = this.gl.ARRAY_BUFFER) {
    const gl = this.gl
    const b = gl.createBuffer()
    if (!b) throw new Error('tank: cannot create buffer')
    gl.bindBuffer(target, b)
    gl.bufferData(target, data, gl.STATIC_DRAW)
    this.buffers.push(b)
    return b
  }

  private gridMesh(cols: number, rows: number, x0: number, y0: number, x1: number, y1: number) {
    const verts = new Float32Array((cols + 1) * (rows + 1) * 2)
    let k = 0
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        verts[k++] = lerp(x0, x1, i / cols)
        verts[k++] = lerp(y0, y1, j / rows)
      }
    }
    const idx = new Uint16Array(cols * rows * 6)
    k = 0
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i
        const b = a + 1
        const c = a + cols + 1
        const d = c + 1
        idx.set([a, b, c, b, d, c], k)
        k += 6
      }
    }
    return { verts, idx }
  }

  private buildGeometry() {
    const gl = this.gl
    const make = () => {
      const v = gl.createVertexArray()
      if (!v) throw new Error('tank: cannot create vertex array')
      return v
    }

    const fullscreen = make()
    gl.bindVertexArray(fullscreen)
    this.buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]))
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const betta = make()
    gl.bindVertexArray(betta)
    const bm = this.gridMesh(64, 32, -0.56, -0.46, 0.56, 0.46)
    this.buffer(bm.verts)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.buffer(bm.idx, gl.ELEMENT_ARRAY_BUFFER)

    const creature = make()
    gl.bindVertexArray(creature)
    const cm = this.gridMesh(40, 16, -0.56, -0.62, 0.56, 0.62)
    this.buffer(cm.verts)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.buffer(cm.idx, gl.ELEMENT_ARRAY_BUFFER)

    const disc = make()
    gl.bindVertexArray(disc)
    this.buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]))
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const particles = make()
    gl.bindVertexArray(particles)
    this.buffer(quad)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const rand = mulberry(20260929)
    const seeds = new Float32Array(PARTICLE_COUNT * 4)
    const index = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      seeds[i * 4] = rand()
      seeds[i * 4 + 1] = rand()
      // Far motes outnumber near ones.
      const r = rand()
      seeds[i * 4 + 2] = r < 0.68 ? (r / 0.68) * 0.5 : 0.5 + ((r - 0.68) / 0.32) * 0.5
      seeds[i * 4 + 3] = rand()
      index[i] = rand()
    }
    this.buffer(seeds)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(1, 1)
    this.buffer(index)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(2, 1)

    const bubbles = make()
    gl.bindVertexArray(bubbles)
    this.buffer(quad)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const ks = new Float32Array(BURST_SLOTS)
    for (let i = 0; i < BURST_SLOTS; i++) ks[i] = i
    this.buffer(ks)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(1, 1)

    // Stand-in for patch slots that are not in use (every sampler needs a texture bound).
    const blank = gl.createTexture()
    if (!blank) throw new Error('tank: cannot create texture')
    gl.bindTexture(gl.TEXTURE_2D, blank)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    this.blankTex = blank

    gl.bindVertexArray(null)
    this.vao = {
      fullscreen,
      betta,
      bettaCount: bm.idx.length,
      creature,
      creatureCount: cm.idx.length,
      disc,
      particles,
      bubbles,
    }
  }

  // ---- sizing and view mapping ----

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    this.width = Math.max(1, cssWidth)
    this.height = Math.max(1, cssHeight)
    this.dpr = dpr
    this.aspect = this.width / this.height
    this.canvas.width = Math.max(1, Math.round(this.width * dpr))
    this.canvas.height = Math.max(1, Math.round(this.height * dpr))
  }

  /** Point of the plate (0..1) to keep in view when the viewport is narrower than the plate. */
  setFocal(x: number, y: number) {
    this.focal = [x, y]
  }

  /** Pointer or device tilt, each axis -1..1. */
  setPointer(x: number, y: number) {
    this.pointer = [clamp(x, -1, 1), clamp(y, -1, 1)]
  }

  private plateMapping() {
    const a = this.aspect
    const span: [number, number] =
      a > PLATE_ASPECT
        ? [PLATE_CROP, (PLATE_CROP * PLATE_ASPECT) / a]
        : [(PLATE_CROP * a) / PLATE_ASPECT, PLATE_CROP]
    const center: [number, number] = [
      clamp(this.focal[0], span[0] / 2, 1 - span[0] / 2),
      clamp(this.focal[1], span[1] / 2, 1 - span[1] / 2),
    ]
    return { span, center }
  }

  /** Plate uv (0..1) to normalised view coordinates. */
  plateToView(px: number, py: number): [number, number] {
    const { span, center } = this.plateMapping()
    return [(px - center[0]) / span[0] + 0.5, (py - center[1]) / span[1] + 0.5]
  }

  /** Plate width expressed in view widths. */
  plateWidthInView(): number {
    return 1 / this.plateMapping().span[0]
  }

  private parallaxView(mult: number): [number, number] {
    // Normalised view units for +-parallaxPx CSS pixels.
    return [
      (this.pointer[0] * this.parallaxPx * mult) / this.width,
      (this.pointer[1] * this.parallaxPx * mult) / this.height,
    ]
  }

  // ---- assets ----

  private async decode(url: string): Promise<HTMLImageElement | null> {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    try {
      await img.decode()
      return img
    } catch (err) {
      console.warn(`tank: failed to load ${url}`, err)
      return null
    }
  }

  private upload(img: HTMLImageElement): Tex | null {
    const gl = this.gl
    const tex = gl.createTexture()
    if (!tex) return null
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return { tex, w: img.naturalWidth, h: img.naturalHeight }
  }

  /** Load a cut-out or overlay by file stem, e.g. 'betta-cruise'. */
  async loadImage(name: string): Promise<void> {
    if (this.images.has(name) || this.requested.has(name)) return
    this.requested.add(name)
    const img = await this.decode(`${ASSET_BASE}/${name}.webp`)
    if (!img || this.lost) return
    const t = this.upload(img)
    if (t) {
      // A re-load (algae plate) must not leak the texture it replaces.
      const old = this.images.get(name)
      if (old) this.gl.deleteTexture(old.tex)
      this.images.set(name, t)
      this.onAsset()
    }
  }

  private freeImage(name: string) {
    const t = this.images.get(name)
    if (t) this.gl.deleteTexture(t.tex)
    this.images.delete(name)
    this.requested.delete(name)
    this.patchReadyAt.delete(name)
  }

  private plateEntry(phase: Phase) {
    let e = this.plates.get(phase)
    if (!e) {
      e = { sm: null, lg: null, loading: new Set() }
      this.plates.set(phase, e)
    }
    return e
  }

  /** Small plate first so the first paint is fast, then the large one. */
  async loadPlate(phase: Phase): Promise<void> {
    const e = this.plateEntry(phase)
    const load = async (size: 'sm' | 'lg') => {
      if (e[size] || e.loading.has(size)) return
      e.loading.add(size)
      const url = `${ASSET_BASE}/plate-${phase}${size === 'sm' ? '-sm' : ''}.webp`
      const img = await this.decode(url)
      e.loading.delete(size)
      if (!img || this.lost) return
      const t = this.upload(img)
      if (t) {
        e[size] = t
        this.onAsset()
      }
    }
    await load('sm')
    await load('lg')
  }

  private plateTex(phase: Phase): Tex | null {
    const e = this.plates.get(phase)
    return e ? (e.lg ?? e.sm) : null
  }

  /** Switch the plate. The first call snaps; later calls crossfade over six seconds. */
  setPhase(phase: Phase) {
    if (this.phaseCur === null) {
      this.phaseCur = phase
      void this.loadPlate(phase)
      return
    }
    if (phase === this.phaseCur && !this.fade) return
    if (this.fade && this.fade.to === phase) return
    if (this.fade) {
      // Changed phase mid-fade: land on the incoming plate, then fade to the new one.
      this.freePlate(this.phaseCur)
      this.phaseCur = this.fade.to
      this.fade = null
    }
    if (phase === this.phaseCur) return
    this.fade = { to: phase, t0: null }
    void this.loadPlate(phase)
  }

  private freePlate(phase: Phase) {
    const e = this.plates.get(phase)
    if (!e) return
    if (e.sm) this.gl.deleteTexture(e.sm.tex)
    if (e.lg) this.gl.deleteTexture(e.lg.tex)
    this.plates.delete(phase)
  }

  /** True once the current plate has a texture to draw. */
  get ready() {
    return this.phaseCur !== null && this.plateTex(this.phaseCur) !== null
  }

  /** Whether a cut-out (e.g. 'betta-cruise') has finished uploading. */
  hasImage(name: string) {
    return this.images.has(name)
  }

  /** New Year: a celebratory burst of bubbles from the substrate, starting at render time `time`. */
  startBurst(time: number) {
    this.burstT0 = time
  }

  /** The 100th-reading golden shimmer, starting at render time `time`. */
  startShimmer(time: number) {
    this.shimmerT0 = time
  }

  // ---- drawing ----

  render(input: RenderInput) {
    if (this.lost) return
    const gl = this.gl
    const { time, env, water } = input
    const dtRender = Math.max(0, Math.min(0.25, time - this.lastTime))
    this.lastTime = time
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!this.phaseCur) return
    const curTex = this.plateTex(this.phaseCur)
    if (!curTex) return

    let mix = 0
    let nextTex: Tex | null = null
    if (this.fade) {
      nextTex = this.plateTex(this.fade.to)
      if (nextTex) {
        if (this.fade.t0 === null) this.fade.t0 = time
        const k = clamp((time - this.fade.t0) / CROSSFADE_SECONDS, 0, 1)
        mix = k * k * (3 - 2 * k)
        if (k >= 1) {
          this.freePlate(this.phaseCur)
          this.phaseCur = this.fade.to
          this.fade = null
          mix = 0
          nextTex = null
        }
      }
    }
    const activeTex = this.plateTex(this.phaseCur) ?? curTex

    const grade = computeGrade(env, water)
    const { span, center } = this.plateMapping()
    const par = this.parallaxView(1)
    const parallaxUV: [number, number] = [par[0] * span[0], par[1] * span[1]]
    const sunDir = env.light.sunDir
    const patches = this.updatePatches(
      time,
      dtRender,
      input,
      nextTex ? this.fade!.to : null,
      mix,
      span,
    )

    // 1. Background.
    const bg = this.progs.bg
    bg.use()
    gl.disable(gl.BLEND)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, activeTex.tex)
    bg.i1('u_plateA', 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, (nextTex ?? activeTex).tex)
    bg.i1('u_plateB', 1)
    bg.f1('u_mix', mix)
    bg.f1('u_hasB', nextTex ? 1 : 0)
    bg.f2('u_plateCenter', center[0], center[1])
    bg.f2('u_plateSpan', span[0], span[1])
    bg.f2('u_parallax', parallaxUV[0], parallaxUV[1])
    bg.f1('u_aspect', this.aspect)
    bg.f1('u_time', time)
    this.gradeUniforms(bg, grade, water)
    bg.f2('u_sunDir', sunDir[0], sunDir[1])
    this.bindPatches(bg, patches)
    bg.f1('u_vignette', 0.22)
    if (this.shimmerT0 !== null && time - this.shimmerT0 > SHIMMER_SECONDS) this.shimmerT0 = null
    bg.f1('u_shimmer', this.shimmerT0 === null ? -1 : (time - this.shimmerT0) / SHIMMER_SECONDS)
    bg.f1('u_glow', env.holiday === 'halloween' ? grade.darkness : 0)
    gl.bindVertexArray(this.vao.fullscreen)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.enable(gl.BLEND)

    if (input.debugAlpha) {
      // Coverage view: black plate, creatures as their final alpha in white, nothing else.
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      const dview = [grade, water, activeTex, center, span, parallaxUV] as const
      const all = [...(input.creatures ?? [])].sort(
        (a, b) => Number(b.plateSpace) - Number(a.plateSpace) || a.z - b.z,
      )
      for (const c of all) this.drawCreature(c, input, ...dview)
      return
    }

    // 2. Far motes and bubbles (the props are already part of the plate).
    this.drawParticles(input, grade, water, 0, 0.5, par)
    this.drawBubbles(input, grade, par)
    this.drawBurst(input, grade, par)

    // 3. Plate creatures, then the swimmers and the betta back to front, then pellets.
    const creatures = input.creatures ?? []
    const view = [grade, water, activeTex, center, span, parallaxUV] as const
    for (const c of creatures) if (c.plateSpace) this.drawCreature(c, input, ...view)
    const swimmers = this.swimScratch
    swimmers.length = 0
    for (const c of creatures) if (!c.plateSpace) swimmers.push(c)
    swimmers.sort((a, b) => a.z - b.z)
    const bettaZ = input.betta ? input.betta.z : Infinity
    let k = 0
    for (; k < swimmers.length && swimmers[k].z <= bettaZ; k++) {
      this.drawCreature(swimmers[k], input, ...view)
    }
    this.drawBetta(input, grade, water, activeTex, center, span, parallaxUV)
    for (; k < swimmers.length; k++) this.drawCreature(swimmers[k], input, ...view)
    this.drawPellets(input, grade)

    // 4. Near motes, glass dust, foreground.
    this.drawParticles(input, grade, water, 0.5, 1.01, par)
    if (water.dust > 0.01) this.drawDust(time, grade, water)
    this.drawStems(grade, water)
  }

  /**
   * Work out which prop patches to draw this frame: smooth the nest and leaf, start loading what is
   * needed (never before), and fade a patch in once its texture arrives.
   */
  private updatePatches(
    time: number,
    dt: number,
    input: RenderInput,
    fadeTo: Phase | null,
    mix: number,
    span: [number, number],
  ): { slots: PatchSlot[]; cover: number } {
    const targets = patchTargets(input.env.season, input.water.bubbleNest, input.water.algae)
    const k = input.instant ? 1 : 1 - Math.exp(-dt / PATCH_FADE_SECONDS)
    this.patchAlpha.nest += (targets.nest - this.patchAlpha.nest) * k
    this.patchAlpha.leaf += (targets.leaf - this.patchAlpha.leaf) * k
    const layers = patchLayers({
      phase: this.phaseCur as Phase,
      fadeTo,
      mix,
      opacities: { nest: this.patchAlpha.nest, leaf: this.patchAlpha.leaf, algae: targets.algae },
    })

    // Large algae plates for phases that are no longer involved can go.
    for (const phase of ['dawn', 'day', 'dusk'] as const) {
      if (phase !== this.phaseCur && phase !== fadeTo) this.freeImage(`patch-algae-${phase}`)
    }

    const slots: PatchSlot[] = []
    let cover = 0
    const pxX = span[0] / this.width
    const pxY = span[1] / this.height
    for (const layer of layers) {
      const tex = this.images.get(layer.key)
      if (!tex) {
        void this.loadImage(layer.key)
        continue
      }
      let readyAt = this.patchReadyAt.get(layer.key)
      if (readyAt === undefined) {
        readyAt = time
        this.patchReadyAt.set(layer.key, readyAt)
      }
      const loaded = input.instant ? 1 : smoothstep(0, PATCH_LOAD_FADE_SECONDS, time - readyAt)
      let sx = 0
      let sy = 0
      if (layer.prop === 'nest') {
        sy = Math.sin(time * 0.6) * BOB_PX * pxY
        sx = Math.sin(time * 0.37 + 1) * WOBBLE_PX * pxX
      } else if (layer.prop === 'leaf') {
        sy = Math.sin(time * 0.45 + 2) * BOB_PX * pxY
        sx = Math.sin(time * 0.29) * WOBBLE_PX * pxX
      }
      const alpha = layer.opacity * loaded
      if (layer.prop === 'algae') cover += layer.weight * loaded
      slots.push({ layer, tex, alpha, shift: [sx, sy] })
    }
    return { slots, cover: clamp(cover, 0, 1) }
  }

  private bindPatches(p: Prog, patches: { slots: PatchSlot[]; cover: number }) {
    const gl = this.gl
    this.alphaBuf.fill(0)
    this.shiftBuf.fill(0)
    for (let i = 0; i < 8; i++) this.rectBuf.set([0, 0, 1, 1], i * 4)
    const texs: (WebGLTexture | null)[] = new Array(8).fill(this.blankTex)
    for (const { layer, tex, alpha, shift } of patches.slots) {
      const meta = patchMeta(layer.prop, layer.phase)
      if (!meta) continue
      const slot = (layer.side === 'A' ? 0 : 4) + PATCH_PROPS.indexOf(layer.prop)
      texs[slot] = tex.tex
      this.rectBuf.set(meta.uv, slot * 4)
      this.alphaBuf[slot] = alpha
      this.shiftBuf[slot * 2] = shift[0]
      this.shiftBuf[slot * 2 + 1] = shift[1]
    }
    for (let i = 0; i < 8; i++) {
      gl.activeTexture(gl.TEXTURE2 + i)
      gl.bindTexture(gl.TEXTURE_2D, texs[i])
      p.i1(`u_pt${i}`, 2 + i)
    }
    p.v4('u_prect', this.rectBuf)
    p.v1array('u_pa', this.alphaBuf)
    p.v2array('u_pshift', this.shiftBuf)
    p.f1('u_algaeCover', patches.cover)
  }

  private gradeUniforms(p: Prog, g: Grade, water: WaterState) {
    p.f1('u_exposure', g.exposure)
    p.v3('u_tint', g.tint)
    p.f1('u_saturation', g.saturation)
    p.f1('u_haze', water.haze)
    p.f1('u_algae', water.algae)
    p.v3('u_hazeColor', g.hazeColor)
    p.f1('u_causticGain', g.causticGain)
    p.v3('u_causticTint', g.causticTint)
    p.f1('u_shaftGain', g.shaftGain)
    p.v3('u_shaftTint', g.shaftTint)
  }

  private lightVec(g: Grade): [number, number, number] {
    const k = g.exposure * g.ambient
    return [g.tint[0] * k, g.tint[1] * k, g.tint[2] * k]
  }

  private bindTex(unit: number, t: Tex) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t.tex)
  }

  private drawParticles(
    input: RenderInput,
    g: Grade,
    water: WaterState,
    z0: number,
    z1: number,
    par: [number, number],
  ) {
    const gl = this.gl
    const p = this.progs.particle
    p.use()
    p.f1('u_time', input.time)
    p.f1('u_aspect', this.aspect)
    p.f1('u_px', 1 / this.width)
    p.f2('u_zRange', z0, z1)
    p.f2('u_sunDir', input.env.light.sunDir[0], input.env.light.sunDir[1])
    p.f1('u_shaftGain', g.shaftGain)
    p.f1('u_sparkle', water.sparkle)
    p.f1('u_count', 0.55 + 0.45 * water.sparkle - 0.15 * water.haze)
    p.f2('u_parallax', par[0], par[1])
    const r = input.ripple
    const age = r ? input.time - r.t0 : 99
    p.f2('u_pointer', r ? r.x : 0, r ? r.y : 0)
    p.f1('u_ripple', r ? Math.exp(-age * 1.8) * smoothstep(0, 0.05, age) : 0)
    p.v3('u_tint', g.moteTint)
    p.f1('u_exposure', g.exposure)
    gl.bindVertexArray(this.vao.particles)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, PARTICLE_COUNT)
  }

  private drawBubbles(input: RenderInput, g: Grade, par: [number, number]) {
    const gl = this.gl
    const p = this.progs.bubble
    p.use()
    const night = g.darkness
    const origin = this.plateToView(0.955, 0.62)
    p.f1('u_time', input.time)
    p.f1('u_aspect', this.aspect)
    p.f1('u_px', 1 / this.width)
    p.f2('u_origin', origin[0], origin[1])
    p.f1('u_period', lerp(26, 44, night))
    p.f1('u_count', Math.round(lerp(BUBBLE_SLOTS, 7, night)))
    p.f1('u_rise', lerp(4.6, 7.5, night))
    p.f1('u_stagger', 0.46)
    p.f1('u_spread', 0.012)
    p.f1('u_size', 1)
    p.f2('u_parallax', par[0], par[1])
    p.v3('u_tint', g.moteTint)
    p.f1('u_exposure', g.exposure)
    gl.bindVertexArray(this.vao.bubbles)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, BUBBLE_SLOTS)
  }

  private drawBurst(input: RenderInput, g: Grade, par: [number, number]) {
    if (this.burstT0 === null) return
    const age = input.time - this.burstT0
    if (age > BURST_SECONDS) {
      this.burstT0 = null
      return
    }
    const gl = this.gl
    const p = this.progs.bubble
    p.use()
    const origin = this.plateToView(0.5, 0.93)
    p.f1('u_time', age)
    p.f1('u_aspect', this.aspect)
    p.f1('u_px', 1 / this.width)
    p.f2('u_origin', origin[0], 0.96)
    p.f1('u_period', 1e5)
    p.f1('u_count', BURST_SLOTS)
    p.f1('u_rise', 5.5)
    p.f1('u_stagger', 0.09)
    p.f1('u_spread', 0.9)
    p.f1('u_size', 1.9)
    p.f2('u_parallax', par[0], par[1])
    p.v3('u_tint', g.moteTint)
    p.f1('u_exposure', Math.max(g.exposure, 0.9) * 1.5)
    gl.bindVertexArray(this.vao.bubbles)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, BURST_SLOTS)
  }

  private drawStems(g: Grade, water: WaterState) {
    const tex = this.images.get('fg-stems')
    if (!tex) return
    const gl = this.gl
    const p = this.progs.cover
    p.use()
    this.bindTex(0, tex)
    p.i1('u_tex', 0)
    const ia = tex.w / tex.h
    const widthView = this.aspect < 0.8 ? 1.5 : this.aspect < 1.3 ? 1.0 : 0.72
    const sx = widthView
    const sy = (widthView * this.aspect) / ia
    const spanX = 1 / sx
    const spanY = 1 / sy
    p.f2('u_span', spanX, spanY)
    p.f2('u_center', 0.5 * spanX, 1 - 0.5 * spanY)
    const par = this.parallaxView(4.2)
    p.f2('u_shift', par[0] * spanX, par[1] * spanY)
    const l = this.lightVec(g)
    const k = 0.62
    p.f3('u_light', l[0] * k, l[1] * k * 0.98, l[2] * k * 1.02)
    p.f1('u_alpha', 1)
    p.f1('u_haze', water.haze)
    p.v3('u_hazeColor', [
      g.hazeColor[0] * g.exposure,
      g.hazeColor[1] * g.exposure,
      g.hazeColor[2] * g.exposure,
    ])
    p.f1('u_bias', 0)
    gl.bindVertexArray(this.vao.fullscreen)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private drawDust(time: number, g: Grade, water: WaterState) {
    const gl = this.gl
    const p = this.progs.dust
    p.use()
    p.f1('u_dust', water.dust)
    p.f1('u_aspect', this.aspect)
    p.f1('u_time', time)
    const l = this.lightVec(g)
    p.f3('u_light', l[0] * 0.8 + 0.1, l[1] * 0.8 + 0.1, l[2] * 0.8 + 0.1)
    gl.bindVertexArray(this.vao.fullscreen)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private drawPellets(input: RenderInput, g: Grade) {
    const pellets = input.pellets ?? input.betta?.pellets ?? []
    if (pellets.length === 0) return
    const gl = this.gl
    const p = this.progs.disc
    p.use()
    gl.bindVertexArray(this.vao.disc)
    const l = this.lightVec(g)
    for (const pellet of pellets) {
      const wob = 0.004 * Math.sin(pellet.age * 3.1 + pellet.id * 2.0)
      // A pellet is a few percent of the body length, so it scales with the fish.
      const r = Math.max(input.fishWidth * 0.0165 * this.width, 3) / this.width
      p.f2('u_center', pellet.x + wob, pellet.y)
      p.f2('u_radius', r, r * this.aspect)
      const k = 0.75 + 0.3 * (1 - g.darkness)
      p.f3('u_color', 0.55 * l[0] * k, 0.36 * l[1] * k, 0.2 * l[2] * k)
      p.f1('u_alpha', pellet.alpha * 0.95)
      p.f1('u_mode', 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  /** Load the cut-outs for these species (file stems under /tank/fish). */
  loadStock(ids: Iterable<string>) {
    for (const id of ids) void this.loadImage(`fish/${id}`)
  }

  /** Load the cut-outs for these species and free the ones no longer in the stock. */
  syncStock(ids: readonly string[]) {
    const keep = new Set(ids.map((id) => `fish/${id}`))
    for (const name of [...this.images.keys(), ...this.requested]) {
      if (name.startsWith('fish/') && !keep.has(name)) this.freeImage(name)
    }
    this.loadStock(ids)
  }

  private drawCreature(
    c: CreatureFrame,
    input: RenderInput,
    g: Grade,
    water: WaterState,
    plate: Tex,
    plateCenter: [number, number],
    plateSpan: [number, number],
    parallaxUV: [number, number],
  ) {
    const gl = this.gl
    const profile = SPECIES[c.species]
    if (!profile || c.alpha < 0.01) return
    const tex = this.images.get(`fish/${c.species}`)
    if (!tex) return
    const fw = input.fishWidth
    const spriteW = (fw * profile.lengthCm) / BETTA_LENGTH_CM
    const scale = c.scale * c.fit
    const par = c.plateSpace ? this.parallaxView(1) : this.parallaxView(1.7)
    const shiftUV: [number, number] = c.plateSpace
      ? [par[0] * plateSpan[0], par[1] * plateSpan[1]]
      : parallaxUV
    const w = spriteW * scale

    // Contact shadow on the substrate, always for the grounded species.
    if (c.shadow && !input.debugAlpha) {
      const d = this.progs.disc
      d.use()
      gl.bindVertexArray(this.vao.disc)
      const foot = c.y + 0.4 * profile.ratio * w * this.aspect
      d.f2('u_center', c.x + par[0] * 0.6 + 0.004, foot)
      d.f2('u_radius', w * 0.4, w * 0.07 * this.aspect)
      d.f3('u_color', 0.01, 0.02, 0.01)
      d.f1('u_alpha', 0.4 * c.alpha * (1 - g.darkness * 0.3))
      d.f1('u_mode', 1)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const p = this.progs.creature
    p.use()
    this.bindTex(0, tex)
    this.bindTex(3, plate)
    p.i1('u_tex', 0)
    p.i1('u_plate', 3)
    const turn = c.turnProgress
    const squash = turn > 0 ? 0.6 + 0.4 * Math.abs(Math.cos(Math.PI * turn)) : 1
    p.f2('u_center', c.x, c.y)
    p.f2('u_shift', par[0], par[1])
    p.f1('u_aspect', this.aspect)
    p.f1('u_spriteW', w * (1 + 0.05 * c.gulp))
    p.f1('u_ratio', profile.ratio)
    p.f1('u_facing', c.facing)
    p.f1('u_widthScale', squash)
    p.f1('u_rot', -c.pitch * c.facing)
    p.f1('u_time', input.time)
    p.f1('u_tailPhase', c.tailPhase)
    p.f1('u_pecPhase', c.pecPhase)
    p.f1('u_wave', c.wave)
    p.f1('u_waveAmp', profile.wave)
    p.f1('u_waveLag', profile.waveLag)
    p.f1('u_headRigid', profile.headRigid)
    p.f1('u_flow', profile.flows ? 1 : 0)
    p.f1('u_pec', profile.pectoral ? 1 : 0)
    p.f1('u_legs', profile.kind === 'shrimp' ? 1 : profile.kind === 'snail' ? 0.3 : 0)
    p.f2('u_plateCenter', plateCenter[0], plateCenter[1])
    p.f2('u_plateSpan', plateSpan[0], plateSpan[1])
    p.f2('u_parallax', shiftUV[0], shiftUV[1])

    // Focus and haze follow depth like the betta; plate creatures sit at the plate's own sharpness.
    const far = smoothstep(0.5, 0.25, c.z)
    const coc = c.z < 0.5 ? (0.5 - c.z) * 2 * 1.3 : (c.z - 0.5) * 2
    p.f1('u_bias', coc * 3.2)
    p.f1('u_far', far)
    p.f1('u_soft', c.soft ? 1 : 0)
    // Pale bodies (corys, otos) and everything on the plate sit deeper in the scene's light.
    const grounded = c.shadow || c.soft
    p.f1('u_gamma', grounded ? 1.35 : 1.1)
    p.f1('u_scatter', grounded ? 0.34 : 0.16)
    p.f1('u_bright', grounded ? (c.soft ? 0.6 : 0.5) + 0.4 * g.darkness : 1)
    const px = 1 / (w * this.width)
    p.f2('u_pxLocal', px, px / profile.ratio)
    p.f1('u_exposure', g.exposure * (1 - 0.08 * far))
    p.v3('u_tint', g.tint)
    p.f1('u_darkness', g.darkness)
    p.f1('u_saturation', (c.soft ? 0.84 : 0.88) * (1 - 0.18 * far))
    p.f1('u_causticGain', g.causticGain)
    p.v3('u_causticTint', g.causticTint)
    p.v3('u_shaftTint', g.shaftTint)
    const sun = input.env.light.sunDir
    p.f2('u_lightLocal', sun[0] * c.facing, sun[1])
    p.f1('u_rimGain', 0.3 * (0.4 + g.shaftGain * 1.4))
    p.f1('u_stress', water.mood === 'stressed' ? 1 : 0)
    p.f1('u_fishHaze', water.haze * 0.42 + 0.14 * far)
    p.v3('u_hazeColor', g.hazeColor)
    p.f1('u_opacity', c.alpha)
    p.f1('u_debugAlpha', input.debugAlpha ? 1 : 0)
    gl.bindVertexArray(this.vao.creature)
    gl.drawElements(gl.TRIANGLES, this.vao.creatureCount, gl.UNSIGNED_SHORT, 0)
  }

  private drawBetta(
    input: RenderInput,
    g: Grade,
    water: WaterState,
    plate: Tex,
    plateCenter: [number, number],
    plateSpan: [number, number],
    parallaxUV: [number, number],
  ) {
    const gl = this.gl
    const b = input.betta
    if (!b) return
    const cruise = this.images.get('betta-cruise')
    if (!cruise) return
    const flare = this.images.get('betta-flare')
    const clamped = this.images.get('betta-clamped')
    let wc = b.pose.cruise
    let wf = flare ? b.pose.flare : 0
    let wk = clamped ? b.pose.clamped : 0
    const sum = wc + wf + wk
    if (sum < 0.001) wc = 1
    else {
      wc /= sum
      wf /= sum
      wk /= sum
    }

    const par = this.parallaxView(1.7)
    const fw = input.fishWidth

    // Soft shadow on the substrate when the fish is low.
    const floorY = 0.9
    const gap = floorY - b.y
    const shadowA = 0.2 * (1 - smoothstep(0.05, 0.26, gap)) * (1 - g.darkness * 0.5)
    if (shadowA > 0.01) {
      const d = this.progs.disc
      d.use()
      gl.bindVertexArray(this.vao.disc)
      d.f2('u_center', b.x + par[0] * 0.6 + 0.01, floorY)
      d.f2('u_radius', fw * 0.34 * b.scale, fw * 0.05 * b.scale * this.aspect)
      d.f3('u_color', 0.01, 0.02, 0.01)
      d.f1('u_alpha', shadowA)
      d.f1('u_mode', 1)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const p = this.progs.betta
    p.use()
    this.bindTex(0, cruise)
    this.bindTex(1, flare ?? cruise)
    this.bindTex(2, clamped ?? cruise)
    this.bindTex(3, plate)
    p.i1('u_texCruise', 0)
    p.i1('u_texFlare', 1)
    p.i1('u_texClamped', 2)
    p.i1('u_plate', 3)
    p.f3('u_poseW', wc, wf, wk)
    p.v4('u_pose', this.poseUniform)

    const turn = b.turnProgress
    const squash = turn > 0 ? 0.15 + 0.85 * Math.abs(Math.cos(Math.PI * turn)) : 1
    const widthScale = squash * (1 - 0.32 * b.viewerFacing)
    p.f2('u_center', b.x, b.y)
    p.f2('u_shift', par[0], par[1])
    p.f1('u_aspect', this.aspect)
    p.f1('u_spriteW', fw)
    p.f1('u_scale', b.scale * (1 + 0.05 * b.gulp))
    p.f1('u_facing', b.facing)
    p.f1('u_widthScale', widthScale)
    p.f1('u_rot', -b.pitch * b.facing)
    p.f1('u_bend', turn > 0 ? 0.09 * Math.sin(Math.PI * turn) * b.heading : 0)
    p.f1('u_time', input.time)
    p.f1('u_tailPhase', b.tailBeatPhase)
    p.f1('u_pecPhase', b.pectoralPhase)
    p.f1('u_breathPhase', b.breathPhase)
    p.f1('u_speedN', clamp(0.2 + b.speed / 0.04, 0, 1.4))
    p.f2('u_accel', b.accel.forward, b.accel.up)
    p.f1('u_fin', b.finSpread)
    p.f1('u_amp', b.mode === 'flare' ? 1.5 : 1)
    p.f2('u_plateCenter', plateCenter[0], plateCenter[1])
    p.f2('u_plateSpan', plateSpan[0], plateSpan[1])
    p.f2('u_parallax', parallaxUV[0], parallaxUV[1])

    // Focus: sharper at the focal plane, softer both ways; further away also reads hazier and flatter.
    const far = smoothstep(0.5, 0.25, b.z)
    const coc = b.z < 0.5 ? (0.5 - b.z) * 2 * 1.3 : (b.z - 0.5) * 2
    p.f1('u_bias', coc * 3.2)
    p.f1('u_far', far)
    p.f2('u_pxLocal', 1 / (fw * b.scale * this.width), 1 / (fw * b.scale * this.width))
    p.f1('u_exposure', g.exposure * (1 - 0.08 * far))
    p.v3('u_tint', g.tint)
    p.f1('u_darkness', g.darkness)
    p.f1('u_saturation', 0.88 * (1 - 0.18 * far))
    p.f1('u_causticGain', g.causticGain)
    p.v3('u_causticTint', g.causticTint)
    p.v3('u_shaftTint', g.shaftTint)
    const sun = input.env.light.sunDir
    p.f2('u_lightLocal', sun[0] * b.facing, sun[1])
    p.f1('u_rimGain', 0.34 * (0.4 + g.shaftGain * 1.4))
    const stress = water.mood === 'stressed' ? 1 : 0
    p.f1('u_stress', stress)
    p.f1('u_fishHaze', water.haze * 0.42 + 0.14 * far)
    p.v3('u_hazeColor', g.hazeColor)
    p.f1('u_opacity', 1)
    gl.bindVertexArray(this.vao.betta)
    gl.drawElements(gl.TRIANGLES, this.vao.bettaCount, gl.UNSIGNED_SHORT, 0)
    void AXIS_Y
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleRestored)
    if (this.lost || !this.gl) return
    const gl = this.gl
    for (const e of this.plates.values()) {
      if (e.sm) gl.deleteTexture(e.sm.tex)
      if (e.lg) gl.deleteTexture(e.lg.tex)
    }
    for (const t of this.images.values()) gl.deleteTexture(t.tex)
    for (const b of this.buffers) gl.deleteBuffer(b)
    const v = this.vao
    for (const a of [v.fullscreen, v.betta, v.creature, v.disc, v.particles, v.bubbles])
      gl.deleteVertexArray(a)
    for (const prog of Object.values(this.progs)) gl.deleteProgram(prog.program)
    this.plates.clear()
    this.images.clear()
    if (this.blankTex) gl.deleteTexture(this.blankTex)
    // Release the context now instead of waiting for GC (browsers cap live contexts).
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    // Late image/plate decodes check this flag and skip their upload.
    this.lost = true
  }
}
