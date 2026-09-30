import fs from 'node:fs'
import path from 'node:path'
import type { Phase } from '@/lib/tank/environment'
import {
  allPatchKeys,
  patchLayers,
  patchMeta,
  patchTargets,
  type PatchLayer,
} from '@/lib/tank/patches'

const none = { nest: 0, leaf: 0, algae: 0 }
const keys = (l: PatchLayer[]) => l.map((p) => p.key).sort()

describe('patchTargets', () => {
  it('turns the nest on with the streak, the leaf on in autumn, and eases algae', () => {
    expect(patchTargets('summer', false, 0)).toEqual({ nest: 0, leaf: 0, algae: 0 })
    expect(patchTargets('autumn', true, 1)).toEqual({ nest: 1, leaf: 1, algae: 1 })
    expect(patchTargets('spring', true, 0).leaf).toBe(0)
    const half = patchTargets('winter', false, 0.5).algae
    expect(half).toBeCloseTo(0.5, 5)
    expect(patchTargets('winter', false, 0.25).algae).toBeLessThan(0.25)
    expect(patchTargets('winter', false, 3).algae).toBe(1)
  })
})

describe('patchLayers', () => {
  it('draws nothing by day with a plain tank', () => {
    expect(patchLayers({ phase: 'day', fadeTo: null, mix: 0, opacities: none })).toEqual([])
  })

  it('has the shrimp on the night plate only', () => {
    const phases: Phase[] = ['dawn', 'day', 'dusk', 'night']
    for (const phase of phases) {
      const l = patchLayers({ phase, fadeTo: null, mix: 0, opacities: none })
      expect(keys(l)).toEqual(phase === 'night' ? ['patch-shrimp-night'] : [])
    }
  })

  it('picks the nest and leaf variant of the current phase with their opacities', () => {
    const l = patchLayers({
      phase: 'dusk',
      fadeTo: null,
      mix: 0,
      opacities: { nest: 0.6, leaf: 1, algae: 0 },
    })
    expect(keys(l)).toEqual(['patch-leaf-dusk', 'patch-nest-dusk'])
    expect(l.find((p) => p.prop === 'nest')?.opacity).toBe(0.6)
    expect(l.every((p) => p.side === 'A')).toBe(true)
  })

  it('uses the algae plate of the phase, and drops it at night', () => {
    const day = patchLayers({
      phase: 'day',
      fadeTo: null,
      mix: 0,
      opacities: { ...none, algae: 0.4 },
    })
    expect(keys(day)).toEqual(['patch-algae-day'])
    expect(day[0].opacity).toBe(0.4)
    const night = patchLayers({
      phase: 'night',
      fadeTo: null,
      mix: 0,
      opacities: { ...none, algae: 1 },
    })
    expect(keys(night)).toEqual(['patch-shrimp-night'])
  })

  it('crossfades patches with their plates on a phase change', () => {
    const opacities = { nest: 1, leaf: 1, algae: 0 }
    const start = patchLayers({ phase: 'dusk', fadeTo: 'night', mix: 0, opacities })
    const mid = patchLayers({ phase: 'dusk', fadeTo: 'night', mix: 0.5, opacities })
    const end = patchLayers({ phase: 'dusk', fadeTo: 'night', mix: 1, opacities })
    const w = (l: PatchLayer[], key: string) => l.find((p) => p.key === key)?.weight
    expect(w(start, 'patch-nest-dusk')).toBe(1)
    expect(w(start, 'patch-nest-night')).toBe(0)
    expect(w(mid, 'patch-nest-dusk')).toBeCloseTo(0.5, 5)
    expect(w(mid, 'patch-nest-night')).toBeCloseTo(0.5, 5)
    expect(w(mid, 'patch-shrimp-night')).toBeCloseTo(0.5, 5)
    expect(w(end, 'patch-nest-dusk')).toBeUndefined()
    expect(w(end, 'patch-leaf-night')).toBe(1)
    // The two sides always add up to the prop's own opacity.
    for (const p of mid.filter((x) => x.prop === 'nest')) expect(p.opacity).toBe(1)
    const sum = mid.filter((x) => x.prop === 'nest').reduce((a, x) => a + x.weight, 0)
    expect(sum).toBeCloseTo(1, 5)
    expect(mid.filter((x) => x.side === 'B').every((x) => x.phase === 'night')).toBe(true)
  })

  it('scales weight by the prop opacity', () => {
    const l = patchLayers({
      phase: 'day',
      fadeTo: 'dusk',
      mix: 0.25,
      opacities: { nest: 0.5, leaf: 0, algae: 0 },
    })
    expect(l.find((p) => p.key === 'patch-nest-day')?.weight).toBeCloseTo(0.375, 5)
    expect(l.find((p) => p.key === 'patch-nest-dusk')?.weight).toBeCloseTo(0.125, 5)
  })
})

describe('patch assets', () => {
  const dir = path.join(process.cwd(), 'public', 'tank')

  it('has a webp for every patch and a valid rectangle', () => {
    const list = allPatchKeys()
    expect(list).toHaveLength(12)
    for (const key of list) {
      expect(fs.existsSync(path.join(dir, `${key}.webp`))).toBe(true)
    }
    for (const prop of ['shrimp', 'nest', 'leaf', 'algae'] as const) {
      for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
        const m = patchMeta(prop, phase)
        if (!m) continue
        const [x0, y0, x1, y1] = m.uv
        expect(x1).toBeGreaterThan(x0)
        expect(y1).toBeGreaterThan(y0)
        expect(x0).toBeGreaterThanOrEqual(0)
        expect(x1).toBeLessThanOrEqual(1)
      }
    }
  })

  it('no longer ships the old sprite props', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    for (const old of ['shrimp', 'leaf', 'nest', 'algae']) {
      expect(manifest[old]).toBeUndefined()
      expect(fs.existsSync(path.join(dir, `${old}.webp`))).toBe(false)
    }
  })
})
