import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('app icon assets', () => {
  it.each(['app/icon.svg', 'public/icons/icon-192.svg', 'public/icons/icon-512.svg'])(
    '%s keeps an opaque background across the full viewBox',
    (file) => {
      const svg = new DOMParser().parseFromString(
        readFileSync(path.join(process.cwd(), file), 'utf8'),
        'image/svg+xml',
      )
      expect(svg.querySelector('parsererror')).toBeNull()
      const bounds = svg.documentElement.getAttribute('viewBox')!.split(' ').map(Number)
      const background = svg.querySelector('rect')!
      expect(Number(background.getAttribute('width'))).toBe(bounds[2])
      expect(Number(background.getAttribute('height'))).toBe(bounds[3])
      expect(background.attributes.getNamedItem('fill')?.value).toBe('url(#water)')
    },
  )
})
