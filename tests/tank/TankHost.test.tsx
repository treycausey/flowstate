import { render, screen, waitFor } from '@testing-library/react'
import TankHost from '@/components/tank/TankHost'
import { DEFAULT_PREFS } from '@/lib/tank/prefs'

jest.mock('@/components/TankProvider', () => ({
  useTanks: () => ({ activeTankId: 't1' }),
}))
jest.mock('@/lib/useTankReadings', () => ({
  useTankReadings: () => ({ readings: [], failed: false }),
}))
const mockStock = jest.fn()
jest.mock('@/lib/stock/forTank', () => ({ useTankStock: () => mockStock() }))
const mockVitality = jest.fn()
jest.mock('@/lib/plants/vitality', () => ({ usePlantVitality: () => mockVitality() }))
jest.mock('@/components/tank/TankScene', () => ({
  __esModule: true,
  default: ({ stock, water }: { stock?: unknown[]; water: { algae: number } }) => (
    <div
      data-testid="tank-scene"
      data-stock={JSON.stringify(stock ?? null)}
      data-algae={water.algae}
    />
  ),
}))
const mockLoad = jest.fn()
jest.mock('@/lib/tank/prefs', () => ({
  ...jest.requireActual('@/lib/tank/prefs'),
  loadTankPrefs: () => mockLoad(),
}))

describe('TankHost', () => {
  beforeEach(() => {
    mockStock.mockReturnValue([])
    mockVitality.mockReturnValue(null)
  })

  afterEach(() => {
    delete document.documentElement.dataset.tankPhase
  })

  it('mounts the scene after first paint when the living tank is on', async () => {
    mockLoad.mockResolvedValue(DEFAULT_PREFS)
    render(<TankHost />)
    expect(screen.queryByTestId('tank-scene')).not.toBeInTheDocument()
    expect(await screen.findByTestId('tank-scene')).toBeInTheDocument()
  })

  it('hands the tank its recorded stock and lets struggling plants dull the water', async () => {
    const stock = [{ speciesId: 'neon-tetra', count: 8, zone: 'middle', kind: 'fish' }]
    mockLoad.mockResolvedValue(DEFAULT_PREFS)
    mockStock.mockReturnValue(stock)
    mockVitality.mockReturnValue(0)
    render(<TankHost />)
    const scene = await screen.findByTestId('tank-scene')
    expect(JSON.parse(scene.dataset.stock!)).toEqual(stock)
    expect(Number(scene.dataset.algae)).toBeGreaterThan(0)
  })

  it('waits for the stock rather than flashing the betta first', async () => {
    mockLoad.mockResolvedValue(DEFAULT_PREFS)
    mockStock.mockReturnValue(null)
    render(<TankHost />)
    await new Promise((r) => setTimeout(r, 700))
    expect(screen.queryByTestId('tank-scene')).not.toBeInTheDocument()
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
