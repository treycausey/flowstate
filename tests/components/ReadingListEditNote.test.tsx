import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReadingList from '@/components/ReadingList'
import { addReading, deleteReading, ensureSeed, listReadingsByTank } from '@/lib/idb'

jest.mock('@/lib/idb', () => {
  const actual = jest.requireActual('@/lib/idb')
  return { ...actual, deleteReading: jest.fn(actual.deleteReading) }
})

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

    expect(await screen.findByText(/edited note/i)).toBeInTheDocument()
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

describe('ReadingList partial edits', () => {
  it('saves a cleared field as null and rejects clearing every field', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: '2021-03-01T00:00:00.000Z',
      pH: 7.1,
      ammonia: 0.5,
      nitrite: 0,
      nitrate: 10,
      note: 'partial-edit',
    })
    renderWithProvider(<ReadingList />)
    const row = (await screen.findByText('partial-edit')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /edit/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit reading/i })
    const fields = [/^pH$/, /^Ammonia \(/, /^Nitrite \(/, /^Nitrate \(/].map((l) =>
      within(dialog).getByLabelText(l),
    )
    // Clear everything: rejected with a form-level alert
    fields.forEach((f) => fireEvent.change(f, { target: { value: '' } }))
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Enter at least one test result.',
    )
    // Fill only ammonia: pH, nitrite, nitrate saved as null
    fireEvent.change(fields[1], { target: { value: '0.25' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const saved = (await listReadingsByTank(tank.id)).find((r) => r.note === 'partial-edit')
    expect(saved).toMatchObject({ pH: null, ammonia: 0.25, nitrite: null, nitrate: null })
  })
})

describe('ReadingList edit kit chips', () => {
  it('sets and clears a metric from chips in the edit dialog', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: '2021-04-01T00:00:00.000Z',
      pH: 7,
      ammonia: null,
      nitrite: null,
      nitrate: 10,
      note: 'chip-edit',
    })
    renderWithProvider(<ReadingList />)
    const row = (await screen.findByText('chip-edit')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /edit/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit reading/i })
    fireEvent.click(within(dialog).getByRole('button', { name: 'NH3 1' }))
    const nitrate = within(dialog).getByRole('button', { name: 'NO3 10' })
    expect(nitrate).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(nitrate)
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const saved = (await listReadingsByTank(tank.id)).find((r) => r.note === 'chip-edit')
    expect(saved).toMatchObject({ pH: 7, ammonia: 1, nitrite: null, nitrate: null })
  })
})

describe('ReadingList typed input', () => {
  it('rejects unparseable text and leaves the stored reading unchanged', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: '2021-05-01T00:00:00.000Z',
      pH: 7,
      ammonia: 0.5,
      nitrite: null,
      nitrate: 10,
      note: 'typo-edit',
    })
    renderWithProvider(<ReadingList />)
    const row = (await screen.findByText('typo-edit')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /edit/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit reading/i })
    fireEvent.change(within(dialog).getByLabelText(/^Ammonia \(/), { target: { value: 'o.5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /save changes/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ammonia (ppm): Enter a number',
    )
    const stored = (await listReadingsByTank(tank.id)).find((r) => r.note === 'typo-edit')
    expect(stored).toMatchObject({ pH: 7, ammonia: 0.5, nitrite: null, nitrate: 10 })
  })
})

describe('ReadingList delete failure', () => {
  it('shows an alert, keeps the dialog open and keeps the reading when delete rejects', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: '2021-06-01T00:00:00.000Z',
      pH: 7,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
      note: 'delete-fails',
    })
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(deleteReading as jest.Mock).mockRejectedValueOnce(new Error('disk full'))
    renderWithProvider(<ReadingList />)
    const row = (await screen.findByText('delete-fails')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /edit/i }))
    const dialog = await screen.findByRole('dialog', { name: /edit reading/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Couldn’t delete: disk full')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('delete-fails')).toBeInTheDocument()
    consoleSpy.mockRestore()
    confirmSpy.mockRestore()
  })
})
