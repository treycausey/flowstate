/**
 * WCAG AA check for the design tokens in app/globals.css. Text needs 4.5:1, UI boundaries and
 * chart marks need 3:1. The frosted panel is translucent, so each text colour is checked
 * against the panel composited over the worst backdrop it can meet: black for the day panel
 * (light panel, dark text) and a bright #c8c8c8 highlight for the night panel. Both panels
 * are also checked at full opacity (reduced-transparency and no-backdrop-filter fallbacks).
 * Set CONTRAST_REPORT=1 to print the ratios.
 */
import fs from 'node:fs'
import path from 'node:path'

type RGB = [number, number, number]
type Tokens = Record<string, string>

const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8')

function tokenBlocks(name: 'day' | 'night'): Tokens[] {
  const re = new RegExp(
    `/\\* tokens:${name}:start \\*/([\\s\\S]*?)/\\* tokens:${name}:end \\*/`,
    'g',
  )
  return [...css.matchAll(re)].map(([, body]) => {
    const tokens: Tokens = {}
    for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[m[1]] = m[2].trim()
    return tokens
  })
}

function parseColor(value: string): { rgb: RGB; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 }
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value)
  if (rgba) {
    const [r, g, b, a] = rgba[1].split(',').map((p) => Number(p.trim()))
    return { rgb: [r, g, b], alpha: a ?? 1 }
  }
  throw new Error(`Unparseable colour: ${value}`)
}

function over(fg: string, backdrop: RGB): RGB {
  const { rgb, alpha } = parseColor(fg)
  return rgb.map((c, i) => c * alpha + backdrop[i] * (1 - alpha)) as RGB
}

function luminance([r, g, b]: RGB) {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TEXT_ON_PANEL = ['ink', 'ink-muted', 'accent', 'danger', 'caution', 'ok'] as const
const WORST_BACKDROP = { day: [0, 0, 0], night: [200, 200, 200] } as const

describe.each(['day', 'night'] as const)('%s tokens', (mode) => {
  const [tokens, ...copies] = tokenBlocks(mode)
  const worst = WORST_BACKDROP[mode] as RGB
  const panels: Record<string, RGB> = {
    'panel (translucent, worst backdrop)': over(tokens['panel-bg'], worst),
    'panel (opaque fallback)': over(tokens['panel-solid'], worst),
  }
  const rows: [string, number][] = []

  it('keeps the explicit and Auto-media copies identical', () => {
    // Night appears twice: explicit selectors and the Auto prefers-color-scheme block
    if (mode === 'night') {
      expect(copies.length).toBeGreaterThan(0)
      for (const copy of copies) expect(copy).toEqual(tokens)
    }
  })

  it.each(Object.keys(panels))('text colours reach 4.5:1 on %s', (panelName) => {
    for (const name of TEXT_ON_PANEL) {
      const ratio = contrast(over(tokens[name], worst), panels[panelName])
      rows.push([`${name} on ${panelName}`, ratio])
      expect([name, ratio >= 4.5]).toEqual([name, true])
    }
  })

  it('text on filled accent (buttons, selected chips) reaches 4.5:1', () => {
    const ratio = contrast(over(tokens['accent-ink'], worst), over(tokens.accent, worst))
    rows.push(['accent-ink on accent', ratio])
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('body text reaches 4.5:1 on the input background', () => {
    const panel = panels['panel (translucent, worst backdrop)']
    const field = over(tokens['field-bg'], panel)
    for (const name of ['ink', 'ink-muted']) {
      const ratio = contrast(over(tokens[name], worst), field)
      rows.push([`${name} on field-bg`, ratio])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('plant health chips: ok, caution and danger text reach 4.5:1 on the chip fill', () => {
    // .health-chip fills with color-mix(panel-solid 70%, transparent) over the panel
    for (const [panelName, panel] of Object.entries(panels)) {
      const solid = over(tokens['panel-solid'], worst)
      const fill = solid.map((c, i) => c * 0.7 + panel[i] * 0.3) as RGB
      for (const name of ['ok', 'caution', 'danger']) {
        const ratio = contrast(over(tokens[name], worst), fill)
        rows.push([`${name} on chip fill over ${panelName}`, ratio])
        expect([panelName, name, ratio >= 4.5]).toEqual([panelName, name, true])
      }
    }
  })

  it('input borders, accent and chart ink reach 3:1 on the panel', () => {
    const panel = panels['panel (translucent, worst backdrop)']
    for (const name of ['field-border', 'accent', 'chart-ink']) {
      const ratio = contrast(over(tokens[name], panel), panel)
      rows.push([`${name} (non-text) on panel`, ratio])
      expect(ratio).toBeGreaterThanOrEqual(3)
    }
  })

  afterAll(() => {
    if (process.env.CONTRAST_REPORT) {
      console.info(`${mode}\n` + rows.map(([label, r]) => `  ${r.toFixed(2)}  ${label}`).join('\n'))
    }
  })
})
