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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^save reading$/i })).toBeEnabled(),
    )
    fireEvent.change(screen.getByLabelText(/^pH$/), { target: { value: '7.3' } })
    fireEvent.change(screen.getByLabelText(/^Ammonia \(/), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/^Nitrite \(/), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/^Nitrate \(/), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/Note/i), { target: { value: 'water change' } })
    fireEvent.click(screen.getByRole('button', { name: /^save reading$/i }))
    await waitFor(async () => {
      const readings = await listReadingsByTank(tank.id)
      expect(readings.length).toBeGreaterThan(0)
    })
    // Note should render in the Recent Readings table
    expect(await screen.findByText(/water change/i)).toBeInTheDocument()
  })
})
