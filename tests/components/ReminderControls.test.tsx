import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReminderControls from '@/components/ReminderControls'
import { addReading, ensureSeed } from '@/lib/idb'
import { emitReadingsChanged } from '@/lib/events'

describe('ReminderControls', () => {
  it('reflects a cadence change immediately and shows the due notice', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    render(
      <TankProvider>
        <ReminderControls />
      </TankProvider>,
    )
    const weekly = await screen.findByRole('button', { name: 'Weekly' })
    expect(weekly).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(weekly)
    await waitFor(() => expect(weekly).toHaveAttribute('aria-pressed', 'true'))
    // No readings yet → due now
    expect(await screen.findByText(/time to test the water/i)).toBeInTheDocument()

    // Logging a reading clears the reminder without a reload
    await addReading({
      tankId: tank.id,
      ts: new Date().toISOString(),
      pH: 7,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
    })
    emitReadingsChanged(tank.id)
    await waitFor(() =>
      expect(screen.queryByText(/time to test the water/i)).not.toBeInTheDocument(),
    )
    expect(screen.getByText(/next/i)).toBeInTheDocument()
  })

  it('validates custom cadence', async () => {
    await ensureSeed()
    render(
      <TankProvider>
        <ReminderControls />
      </TankProvider>,
    )
    const input = await screen.findByLabelText(/every n days/i)
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set' }))
    expect(await screen.findByText(/whole days from 1 to 365/i)).toBeInTheDocument()
  })
})
