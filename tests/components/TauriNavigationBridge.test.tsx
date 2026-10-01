import { render } from '@testing-library/react'
import TauriNavigationBridge from '@/components/TauriNavigationBridge'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/TankProvider', () => ({ useTanks: () => ({ activeTankId: 'a' }) }))

let resolveListen: (off: () => void) => void
const mockListen = jest.fn(
  () =>
    new Promise<() => void>((resolve) => {
      resolveListen = resolve
    }),
)
jest.mock('@tauri-apps/api/event', () => ({ listen: () => mockListen() }))

it('unlistens a listener that resolves after the component unmounted', async () => {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  const off = jest.fn()
  const { unmount } = render(<TauriNavigationBridge />)
  await new Promise((r) => setTimeout(r, 0))
  unmount()
  resolveListen(off)
  await new Promise((r) => setTimeout(r, 0))
  expect(off).toHaveBeenCalledTimes(1)
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})
