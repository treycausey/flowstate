import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import { ensureSeed } from '@/lib/idb'
import TankSwitcher from '@/components/TankSwitcher'

function renderWithProvider(ui: React.ReactNode) {
  return render(<TankProvider>{ui}</TankProvider>)
}

describe('TankSwitcher', () => {
  it('creates a new tank via prompt', async () => {
    await ensureSeed()
    const spy = jest.spyOn(window, 'prompt').mockReturnValue('My Test Tank' as any)
    renderWithProvider(<TankSwitcher />)
    const createBtn = await screen.findByRole('button', { name: /new/i })
    fireEvent.click(createBtn)
    // The new tank is added to the select and becomes the active tank
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /^tank$/i })).toHaveDisplayValue('My Test Tank'),
    )
    spy.mockRestore()
  })
})
