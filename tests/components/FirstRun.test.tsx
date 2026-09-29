import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import HomeClient from '@/components/HomeClient'
import { archiveTank, createTank, listTanks } from '@/lib/idb'

// Runs against an empty database: this file must not seed tanks before the first test.
describe('first run and tank selection', () => {
  beforeEach(() => localStorage.clear())

  it('seeds a tank and enables entry on a brand-new install without a reload', async () => {
    expect(await listTanks()).toHaveLength(0)
    render(
      <TankProvider>
        <HomeClient />
      </TankProvider>,
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^save reading$/i })).toBeEnabled(),
    )
    expect(screen.getByRole('combobox', { name: /^tank$/i })).toHaveDisplayValue('My Tank')
    expect(await listTanks()).toHaveLength(1)
  })

  it('restores the saved tank instead of resetting to the first', async () => {
    const second = await createTank('Second')
    localStorage.setItem('activeTankId', second.id)
    render(
      <TankProvider>
        <HomeClient />
      </TankProvider>,
    )
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /^tank$/i })).toHaveDisplayValue('Second'),
    )
  })

  it('falls back to an unarchived tank when the saved one is archived', async () => {
    const gone = await createTank('Gone')
    await archiveTank(gone.id)
    localStorage.setItem('activeTankId', gone.id)
    render(
      <TankProvider>
        <HomeClient />
      </TankProvider>,
    )
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /^tank$/i })).toHaveDisplayValue('My Tank'),
    )
    expect(screen.queryByRole('option', { name: 'Gone' })).not.toBeInTheDocument()
  })
})
