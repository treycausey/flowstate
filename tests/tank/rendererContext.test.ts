import { TankRenderer } from '@/lib/tank/renderer'
import { TextureLoadTracker } from '@/lib/tank/loadTracker'

type Pending = { url: string; resolve: () => void; reject: () => void }
let pending: Pending[] = []

class FakeImage {
  decoding = ''
  naturalWidth = 4
  naturalHeight = 4
  src = ''
  decode() {
    return new Promise<void>((resolve, reject) =>
      pending.push({ url: this.src, resolve, reject: () => reject(new Error('decode failed')) }),
    )
  }
}

function makeGl() {
  const live = new Set<object>()
  const uploaded = new Set<object>()
  let bound: object | null = null
  const created: object[] = []
  const target: Record<string, unknown> = {
    createTexture: () => {
      const t = {}
      live.add(t)
      created.push(t)
      return t
    },
    deleteTexture: (t: object) => live.delete(t),
    bindTexture: (_target: number, t: object) => {
      bound = t
    },
    // Only image uploads (6 args) count; the 1x1 blank texture uses the long form.
    texImage2D: (...args: unknown[]) => {
      if (args.length === 6 && bound) uploaded.add(bound)
    },
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getExtension: () => null,
  }
  const gl = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop as string]
      // Constants are numbers; everything else is a no-op returning an object.
      if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) return 1
      return () => ({})
    },
  })
  return { gl, live, uploaded, created }
}

function setup() {
  const { gl, live, uploaded, created } = makeGl()
  const canvas = document.createElement('canvas')
  jest.spyOn(canvas, 'getContext').mockReturnValue(gl as unknown as WebGL2RenderingContext)
  ;(globalThis as unknown as { WebGL2RenderingContext: unknown }).WebGL2RenderingContext = class {}
  const r = TankRenderer.create(canvas, () => {})!
  expect(r).toBeTruthy()
  return {
    r,
    canvas,
    live: {
      get size() {
        return [...uploaded].filter((t) => live.has(t)).length
      },
    },
    uploads: uploaded,
    created,
  }
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

async function resolveAll() {
  const batch = pending
  pending = []
  batch.forEach((p) => p.resolve())
  await flush()
}

async function resolveOne(i: number) {
  const [p] = pending.splice(i, 1)
  p.resolve()
  await flush()
}

async function drain() {
  for (let i = 0; i < 6; i++) await resolveAll()
}

type PlateEntry = { sm: object | null; lg: object | null }
const platesOf = (r: TankRenderer) => (r as unknown as { plates: Map<string, PlateEntry> }).plates
const referenced = (r: TankRenderer) =>
  [...platesOf(r).values()].reduce((n, e) => n + (e.sm ? 1 : 0) + (e.lg ? 1 : 0), 0)

const loss = (c: HTMLCanvasElement) => c.dispatchEvent(new Event('webglcontextlost'))
const restore = (c: HTMLCanvasElement) => c.dispatchEvent(new Event('webglcontextrestored'))

beforeEach(() => {
  pending = []
  ;(globalThis as unknown as { Image: unknown }).Image = FakeImage
})
afterEach(() => jest.restoreAllMocks())

describe('TankRenderer texture loads across context loss', () => {
  it('drops a decode started before loss that resolves after restore; reload uploads once', async () => {
    const { r, canvas, live, uploads } = setup()
    void r.loadImage('fish/neon')
    expect(pending).toHaveLength(1)
    loss(canvas)
    restore(canvas) // restore reloads the requested key: a second decode
    expect(pending).toHaveLength(2)
    await resolveAll()
    expect(r.hasImage('fish/neon')).toBe(true)
    expect(live.size).toBe(1)
    expect(uploads.size).toBe(1) // the stale decode never uploaded
  })

  it('drops a stale plate decode and does not upload into the orphaned entry', async () => {
    const { r, canvas, live } = setup()
    r.setPhase('day')
    expect(pending).toHaveLength(1) // sm
    loss(canvas)
    restore(canvas) // reload of the current plate starts a fresh sm decode
    await resolveAll() // old and new sm resolve; only the new one uploads
    expect(live.size).toBe(1)
    await resolveAll() // lg
    expect(live.size).toBe(2)
  })

  it('a stale small-plate decode finishing last does not start a large load that supersedes the current one', async () => {
    const { r, canvas, live } = setup()
    r.setPhase('day')
    loss(canvas)
    restore(canvas)
    expect(pending).toHaveLength(2) // [old sm, new sm]
    await resolveOne(1) // new sm uploads, new loader begins lg
    await resolveOne(0) // old sm resolves stale; old loader must stop
    await drain()
    const entry = platesOf(r).get('day')!
    expect(entry.sm).not.toBeNull()
    expect(entry.lg).not.toBeNull()
    expect(live.size).toBe(referenced(r))
  })

  it('two quick phase changes during a crossfade leave no orphaned plate textures', async () => {
    const { r, live } = setup()
    r.setPhase('day')
    r.setPhase('dusk') // fade day -> dusk
    r.setPhase('night') // mid-fade: day is freed while its sm decodes
    await drain()
    expect(platesOf(r).has('day')).toBe(false)
    expect(live.size).toBe(referenced(r))
    expect(platesOf(r).get('night')!.lg).not.toBeNull()
  })

  it('a failed decode can be retried', async () => {
    const { r } = setup()
    void r.loadImage('fish/neon')
    pending.shift()!.reject()
    await flush()
    void r.loadImage('fish/neon')
    expect(pending).toHaveLength(1)
  })

  it('freeImage while in flight does not upload', async () => {
    const { r, live } = setup()
    void r.loadImage('fish/neon')
    ;(r as unknown as { freeImage(n: string): void }).freeImage('fish/neon')
    await resolveAll()
    expect(r.hasImage('fish/neon')).toBe(false)
    expect(live.size).toBe(0)
  })

  it('destroy while in flight does not upload', async () => {
    const { r, live } = setup()
    void r.loadImage('fish/neon')
    r.setPhase('day')
    r.destroy()
    await resolveAll()
    expect(live.size).toBe(0)
  })
})

describe('TextureLoadTracker', () => {
  it('invalidates tokens, cancels keys, and supersedes older loads', () => {
    const t = new TextureLoadTracker()
    const a = t.begin('k')
    const b = t.begin('k')
    expect(t.isCurrent(a)).toBe(false)
    expect(t.isCurrent(b)).toBe(true)
    t.cancel('k')
    expect(t.isCurrent(b)).toBe(false)
    const c = t.begin('x')
    t.invalidate()
    expect(t.isCurrent(c)).toBe(false)
  })
})
