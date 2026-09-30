import { act, render, screen, waitFor } from '@testing-library/react'
import TankHost from '@/components/tank/TankHost'
import { DEFAULT_PREFS } from '@/lib/tank/prefs'

const mockTank = jest.fn(() => 't1')
jest.mock('@/components/TankProvider', () => ({
  useTanks: () => ({ activeTankId: mockTank() }),
}))
jest.mock('@/lib/useTankReadings', () => ({
  useTankReadings: () => ({ readings: [], failed: false }),
}))
const mockStock = jest.fn()
jest.mock('@/lib/stock/forTank', () => ({ useTankStock: () => mockStock() }))
const mockSceneStocks: unknown[] = []
const mockVitality = jest.fn()
jest.mock('@/lib/plants/vitality', () => ({ usePlantVitality: () => mockVitality() }))
jest.mock('@/components/tank/TankScene', () => ({
  __esModule: true,
  default: ({ stock, water }: { stock?: unknown[]; water: { algae: number } }) => {
    mockSceneStocks.push(stock)
    return (
      <div
        data-testid="tank-scene"
        data-stock={JSON.stringify(stock ?? null)}
        data-algae={water.algae}
      />
    )
  },
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

  describe('while the stock loads', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    const settle = async (ms: number) => {
      // In small steps, so the state updates between timers are flushed like a real clock would.
      for (let t = 0; t < ms; t += 100) {
        await act(async () => {
          await jest.advanceTimersByTimeAsync(100)
        })
      }
    }

    it('waits for the stock rather than flashing the betta first', async () => {
      mockLoad.mockResolvedValue(DEFAULT_PREFS)
      mockStock.mockReturnValue(null)
      render(<TankHost />)
      await settle(1000)
      expect(screen.queryByTestId('tank-scene')).not.toBeInTheDocument()
    })

    it('shows the betta after 1.5 s if the stock never loads', async () => {
      mockLoad.mockResolvedValue(DEFAULT_PREFS)
      mockStock.mockReturnValue(null)
      render(<TankHost />)
      await settle(1000)
      expect(screen.queryByTestId('tank-scene')).not.toBeInTheDocument()
      await settle(2000)
      expect(screen.getByTestId('tank-scene')).toBeInTheDocument()
    })

    it('keeps the last stock on screen while another tank loads', async () => {
      const a = [{ speciesId: 'neon-tetra', count: 8, zone: 'middle', kind: 'fish' }]
      const b = [{ speciesId: 'guppy', count: 4, zone: 'top', kind: 'fish' }]
      mockLoad.mockResolvedValue(DEFAULT_PREFS)
      mockStock.mockReturnValue(a)
      const { rerender } = render(<TankHost />)
      await settle(3000)
      expect(JSON.parse(screen.getByTestId('tank-scene').dataset.stock!)).toEqual(a)
      mockSceneStocks.length = 0
      // Switch tanks: the new tank's stock is not known yet.
      mockTank.mockReturnValue('t2')
      mockStock.mockReturnValue(null)
      rerender(<TankHost />)
      await settle(2000)
      expect(JSON.parse(screen.getByTestId('tank-scene').dataset.stock!)).toEqual(a)
      mockStock.mockReturnValue(b)
      rerender(<TankHost />)
      await settle(100)
      expect(JSON.parse(screen.getByTestId('tank-scene').dataset.stock!)).toEqual(b)
      // The scene never saw an empty (undefined) stock in between.
      expect(mockSceneStocks.every((x) => x !== undefined)).toBe(true)
      mockTank.mockReturnValue('t1')
    })
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
