import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
})
