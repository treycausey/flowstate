import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import TankStatus, { TankStatusView } from '@/components/TankStatus'
import { addReading, ensureSeed, listReadingsByTank } from '@/lib/idb'
import type { Reading } from '@/lib/models'

jest.mock('@/lib/idb', () => {
  const actual = jest.requireActual('@/lib/idb')
  return { ...actual, listReadingsByTank: jest.fn(actual.listReadingsByTank) }
})

const NOW = new Date('2026-02-10T12:00:00.000Z')
function reading(id: string, ts: string, values: Partial<Reading>): Reading {
  return { id, tankId: 't', ts, pH: null, ammonia: null, nitrite: null, nitrate: null, ...values }
}

describe('TankStatusView', () => {
  it('handles an empty tank', () => {
    render(<TankStatusView readings={[]} now={NOW} />)
    expect(screen.getByText(/No tests yet/)).toBeInTheDocument()
    expect(screen.queryByText(/Nitrogen cycle/)).not.toBeInTheDocument()
  })

  it('shows cycle status, days since last test, values, trends and range emphasis', () => {
    render(
      <TankStatusView
        now={NOW}
        readings={[
          reading('1', '2026-02-06T12:00:00.000Z', { ammonia: 0.25, nitrate: 10 }),
          reading('2', '2026-02-08T12:00:00.000Z', { ammonia: 0.5, nitrite: 0.25, nitrate: 30 }),
        ]}
      />,
    )
    expect(screen.getByText('Cycling')).toBeInTheDocument()
    expect(screen.getByText('Last test: 2 days ago')).toBeInTheDocument()

    const ammonia = screen.getByText('NH3').closest('div')!
    expect(within(ammonia).getByText(/^0\.5/)).toHaveClass('flag--high')
    expect(within(ammonia).getByText(/out of range/)).toBeInTheDocument()
    expect(within(ammonia).getByText(/trend up from 0\.25/)).toBeInTheDocument()

    const nitrate = screen.getByText('NO3').closest('div')!
    expect(within(nitrate).getByText(/^30/)).toHaveClass('flag--caution')
    expect(within(nitrate).getByText(/trend up from 10/)).toBeInTheDocument()

    // Only one nitrite test: no trend. pH never tested.
    const nitrite = screen.getByText('NO2').closest('div')!
    expect(within(nitrite).queryByText(/trend/)).not.toBeInTheDocument()
    const ph = screen.getByText('pH').closest('div')!
    expect(within(ph).getByText('not tested yet')).toBeInTheDocument()
  })
})

describe('TankStatus', () => {
  it('shows nothing (not "No tests yet") until readings have loaded', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    render(
      <TankProvider>
        <TankStatus />
      </TankProvider>,
    )
    expect(screen.queryByText(/No tests yet/)).not.toBeInTheDocument()
    expect(await screen.findByText(/No tests yet/)).toBeInTheDocument()
  })

  it('loads the active tank and shows cycling for a partial ammonia + nitrite reading', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: new Date().toISOString(),
      pH: null,
      ammonia: 0.5,
      nitrite: 0.25,
      nitrate: null,
    })
    render(
      <TankProvider>
        <TankStatus />
      </TankProvider>,
    )
    expect(await screen.findByText('Cycling')).toBeInTheDocument()
    expect(screen.getByText('Last test: today')).toBeInTheDocument()
  })

  it('shows a readable error when loading readings fails', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    jest.mocked(listReadingsByTank).mockRejectedValueOnce(new Error('boom'))
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <TankProvider>
        <TankStatus />
      </TankProvider>,
    )
    expect(await screen.findByText(/Couldn.t load status/)).toBeInTheDocument()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
