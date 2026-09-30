import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReportClient from '@/components/ReportClient'
import PlantsStatusLine from '@/components/plants/PlantsStatusLine'
import StorageError from '@/components/StorageError'
import { ensureSeed, listPlantsByTank, listReadingsByTank, listTanks } from '@/lib/idb'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/idb', () => {
  const actual = jest.requireActual('@/lib/idb')
  return {
    ...actual,
    listPlantsByTank: jest.fn(actual.listPlantsByTank),
    listReadingsByTank: jest.fn(actual.listReadingsByTank),
    listTanks: jest.fn(actual.listTanks),
  }
})

describe('load failures are visible', () => {
  let errSpy: jest.SpyInstance
  beforeEach(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => errSpy.mockRestore())

  it('the report says when plants could not load', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    jest.mocked(listPlantsByTank).mockRejectedValue(new Error('boom'))
    render(
      <TankProvider>
        <ReportClient />
      </TankProvider>,
    )
    expect(await screen.findByText(/Couldn.t load plants\./)).toHaveAttribute('role', 'alert')
    jest.mocked(listPlantsByTank).mockReset()
  })

  it('the report shows a readable error when readings fail, never "null"', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    jest.mocked(listReadingsByTank).mockRejectedValueOnce(null)
    render(
      <TankProvider>
        <ReportClient />
      </TankProvider>,
    )
    const alert = await screen.findByText(/Couldn.t load readings/)
    expect(alert).toHaveAttribute('role', 'alert')
    expect(alert).not.toHaveTextContent(/null|undefined/)
  })

  it('every page says why the data could not open (another tab blocks the upgrade)', async () => {
    jest
      .mocked(listTanks)
      .mockRejectedValueOnce(new Error('Flowstate is open in another tab. Close it and reload.'))
    render(
      <TankProvider>
        <StorageError />
      </TankProvider>,
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Couldn't open your data. Flowstate is open in another tab. Close it and reload.",
    )
  })

  it('the Log status line says when plants could not load', async () => {
    const tank = await ensureSeed()
    jest.mocked(listPlantsByTank).mockRejectedValue(new Error('boom'))
    render(<PlantsStatusLine tankId={tank.id} />)
    expect(await screen.findByText(/Couldn.t load plants\./)).toHaveAttribute('role', 'alert')
  })
})
