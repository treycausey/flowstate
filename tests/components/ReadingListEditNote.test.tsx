import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReadingList from '@/components/ReadingList'
import { addReading, ensureSeed } from '@/lib/idb'

function renderWithProvider(ui: React.ReactNode) {
  return render(<TankProvider>{ui}</TankProvider>)
}

describe('ReadingList edit note', () => {
  it('edits a reading note inline and updates the table', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: /edit/i }))
    await screen.findByRole('dialog', { name: /edit reading/i })
    const noteInput = await screen.findByLabelText(/note/i)
    fireEvent.change(noteInput, { target: { value: 'edited note' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.getByText(/edited note/i)).toBeInTheDocument())
  })
})

describe('ReadingList delete and ordering', () => {
  it('lists newest first and deletes from the edit dialog', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    const base = { tankId: tank.id, pH: 7, ammonia: 0, nitrite: 0, nitrate: 5 }
    await addReading({ ...base, ts: '2020-01-01T00:00:00.000Z', note: 'oldest' })
    await addReading({ ...base, ts: '2020-01-05T00:00:00.000Z', note: 'newest' })
    render(
      <TankProvider>
        <ReadingList />
      </TankProvider>,
    )
    await screen.findByText('oldest')
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '')
    expect(rows.findIndex((t) => t.includes('newest'))).toBeLessThan(
      rows.findIndex((t) => t.includes('oldest')),
    )
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const oldestRow = screen.getByText('oldest').closest('tr')!
    fireEvent.click(within(oldestRow).getByRole('button', { name: /edit/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit reading/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByText('oldest')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    confirmSpy.mockRestore()
  })
})
