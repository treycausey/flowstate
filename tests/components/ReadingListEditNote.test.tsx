import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReadingList from '@/components/ReadingList'
import { addReading, ensureSeed } from '@/lib/idb'

function renderWithProvider(ui: React.ReactNode) {
  return render(<TankProvider>{ui}</TankProvider>)
}

describe('ReadingList edit note', () => {
  it('edits a reading note via prompt and updates the table', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: new Date().toISOString(),
      pH: 7.1,
      ammonia: 0,
      nitrite: 0,
      nitrate: 10,
      note: 'old note',
    })
    renderWithProvider(<ReadingList />)
    // Wait for table to render
    await screen.findByText(/Recent Readings/i)
    // Mock prompt sequence
    const prompts = [
      '7.1', // pH
      '0', // ammonia
      '0', // nitrite
      '10', // nitrate
      'edited note', // note
    ]
    const promptSpy = jest.spyOn(window, 'prompt').mockImplementation(() => prompts.shift() as any)

    fireEvent.click(await screen.findByRole('button', { name: /edit/i }))

    // New note appears
    await waitFor(() => expect(screen.getByText(/edited note/i)).toBeInTheDocument())

    promptSpy.mockRestore()
  })
})

