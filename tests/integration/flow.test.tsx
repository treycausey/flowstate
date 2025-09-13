import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import HomeClient from '@/components/HomeClient'
import { listReadingsByTank, ensureSeed } from '@/lib/idb'

function App() {
  return (
    <TankProvider>
      <HomeClient />
    </TankProvider>
  )
}

describe('integration: create → add reading → visualize', () => {
  it('adds a reading and it appears in list', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    render(<App />)
    fireEvent.change(screen.getByLabelText(/pH/i), { target: { value: '7.3' } })
    fireEvent.change(screen.getByLabelText(/Ammonia/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/Nitrite/i), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/Nitrate/i), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/Note/i), { target: { value: 'water change' } })
    jest.spyOn(window, 'alert').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(async () => {
      const readings = await listReadingsByTank(tank.id)
      expect(readings.length).toBeGreaterThan(0)
    })
    // Note should render in the Recent Readings table
    await waitFor(() => expect(screen.getByText(/water change/i)).toBeInTheDocument())
  })
})
