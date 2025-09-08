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

