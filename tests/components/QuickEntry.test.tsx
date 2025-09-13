import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { TankProvider } from '@/components/TankProvider'
import QuickEntry from '@/components/QuickEntry'
import { ensureSeed, findMostRecentReading, addReading, listReadingsByTank } from '@/lib/idb'

function renderWithProvider(ui: React.ReactNode) {
  return render(<TankProvider>{ui}</TankProvider>)
}

describe('QuickEntry', () => {
  it('saves a reading for the active tank', async () => {
    const tank = await ensureSeed()
    // Ensure provider picks the same active tank
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    fireEvent.change(screen.getByLabelText(/pH/i), { target: { value: '7.2' } })
    fireEvent.change(screen.getByLabelText(/Ammonia/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/Nitrite/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/Nitrate/i), { target: { value: '10' } })
    // Avoid actual alert in JSDOM
    jest.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(async () => {
      const readings = await listReadingsByTank(tank.id)
      expect(readings.length).toBeGreaterThan(0)
      const last = readings[readings.length - 1]
      expect(last?.pH).toBe(7.2)
    }, { timeout: 3000 })
  })

  it('prefills with last values', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: new Date().toISOString(),
      pH: 7.1,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
      note: 'seed',
    })
    renderWithProvider(<QuickEntry />)
    fireEvent.click(screen.getByRole('button', { name: /use last values/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/pH/i)).toHaveValue(7.1)
    }, { timeout: 3000 })
  })

  it('shows Instructions modal and closes', async () => {
    renderWithProvider(<QuickEntry />)
    // Open
    fireEvent.click(screen.getByRole('button', { name: /instructions/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instructions/i })).toBeInTheDocument()
    // Close
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('starts a 30-second timer and ticks down outside modal', async () => {
    jest.useFakeTimers()
    renderWithProvider(<QuickEntry />)
    fireEvent.click(screen.getByRole('button', { name: /instructions/i }))
    const startBtn = await screen.findByRole('button', { name: /NO3 \(30 seconds\)/i })
    fireEvent.click(startBtn)
    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Timers panel visible outside
    expect(screen.getByText(/Timers/i)).toBeInTheDocument()
    expect(screen.getByText(/NO3 \(30 seconds\)/i)).toBeInTheDocument()
    expect(screen.getByText(/00:30/)).toBeInTheDocument()
    // Advance 1s and assert it ticks
    act(() => { jest.advanceTimersByTime(1000) })
    await waitFor(() => expect(screen.getByText(/00:29/)).toBeInTheDocument())
    jest.useRealTimers()
  })

  it('renders a progress ring for timers', async () => {
    jest.useFakeTimers()
    renderWithProvider(<QuickEntry />)
    fireEvent.click(screen.getByRole('button', { name: /instructions/i }))
    // Start two different timers
    fireEvent.click(await screen.findByRole('button', { name: /NO3 \(30 seconds\)/i }))
    fireEvent.click(await screen.findByRole('button', { name: /NO3 \(1 minute\)/i }))
    // Close modal and verify two rings exist
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    const rings = await screen.findAllByTestId('timer-ring')
    expect(rings.length).toBeGreaterThanOrEqual(2)
    jest.useRealTimers()
  })
})
