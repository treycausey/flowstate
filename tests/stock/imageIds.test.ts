/** @jest-environment node */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stockImageIds } from '@/lib/stock/imageIds'

function publicDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'flowstate-public-'))
}

describe('stockImageIds', () => {
  it('lists the fish cut-outs and adds betta when its shared frame exists', () => {
    const dir = publicDir()
    mkdirSync(path.join(dir, 'tank', 'fish'), { recursive: true })
    writeFileSync(path.join(dir, 'tank', 'fish', 'neon-tetra.webp'), '')
    writeFileSync(path.join(dir, 'tank', 'betta-cruise.webp'), '')
    expect(stockImageIds(dir).sort()).toEqual(['betta', 'neon-tetra'])
  })

  it('has betta alone when public/tank/fish is absent, and nothing without the frame', () => {
    const dir = publicDir()
    mkdirSync(path.join(dir, 'tank'), { recursive: true })
    expect(stockImageIds(dir)).toEqual([])
    writeFileSync(path.join(dir, 'tank', 'betta-cruise.webp'), '')
    expect(stockImageIds(dir)).toEqual(['betta'])
  })

  it('finds the betta frame in the real public folder', () => {
    expect(stockImageIds()).toContain('betta')
  })
})
