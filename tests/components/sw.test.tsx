import { render } from '@testing-library/react'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

describe('ServiceWorkerRegister', () => {
  it('registers service worker when supported', async () => {
    const register = jest.fn().mockResolvedValue({ addEventListener: jest.fn() })
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    })
    render(<ServiceWorkerRegister />)
    expect(register).toHaveBeenCalled()
  })
})

describe('service worker precache list', () => {
  it('includes the living-tank first-paint plates and every listed file exists', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const src = fs.readFileSync(path.join(process.cwd(), 'public/service-worker.js'), 'utf8')
    const tankFiles = [...src.matchAll(/'(\/tank\/[^']+)'/g)].map((m) => m[1])
    for (const f of [
      '/tank/plate-dawn-sm.webp',
      '/tank/plate-day-sm.webp',
      '/tank/plate-dusk-sm.webp',
      '/tank/plate-night-sm.webp',
      '/tank/betta-cruise.webp',
    ]) {
      expect(tankFiles).toContain(f)
    }
    for (const f of tankFiles)
      expect(fs.existsSync(path.join(process.cwd(), 'public', f))).toBe(true)
  })
})
