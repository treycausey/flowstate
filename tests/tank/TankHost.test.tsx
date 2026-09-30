import { render, screen, waitFor } from '@testing-library/react'
import TankHost from '@/components/tank/TankHost'
import { DEFAULT_PREFS } from '@/lib/tank/prefs'

jest.mock('@/components/TankProvider', () => ({
  useTanks: () => ({ activeTankId: 't1' }),
}))
jest.mock('@/lib/useTankReadings', () => ({
  useTankReadings: () => ({ readings: [], failed: false }),
}))
jest.mock('@/components/tank/TankScene', () => ({
  __esModule: true,
  default: () => <div data-testid="tank-scene" />,
}))
const mockLoad = jest.fn()
jest.mock('@/lib/tank/prefs', () => ({
  ...jest.requireActual('@/lib/tank/prefs'),
  loadTankPrefs: () => mockLoad(),
}))

describe('TankHost', () => {
  afterEach(() => {
    delete document.documentElement.dataset.tankPhase
  })

  it('mounts the scene after first paint when the living tank is on', async () => {
    mockLoad.mockResolvedValue(DEFAULT_PREFS)
    render(<TankHost />)
    expect(screen.queryByTestId('tank-scene')).not.toBeInTheDocument()
    expect(await screen.findByTestId('tank-scene')).toBeInTheDocument()
  })

  it('never mounts the scene when the setting is off, but still publishes the phase', async () => {
    mockLoad.mockResolvedValue({ ...DEFAULT_PREFS, livingTank: false })
    render(<TankHost />)
    await waitFor(() => expect(document.documentElement.dataset.tankPhase).toBeDefined())
    await new Promise((r) => setTimeout(r, 600))
    expect(screen.queryByTestId('tank-scene')).not.toBeInTheDocument()
  })

  it('keeps data-tank-phase on unmount so the theme cannot blink', async () => {
    mockLoad.mockResolvedValue({ ...DEFAULT_PREFS, livingTank: false })
    const { unmount } = render(<TankHost />)
    await waitFor(() => expect(document.documentElement.dataset.tankPhase).toBeDefined())
    unmount()
    expect(document.documentElement.dataset.tankPhase).toBeDefined()
  })
})
