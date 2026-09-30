import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReportClient from '@/components/ReportClient'
import { addReading, createTank, ensureSeed, listReadingsByTank } from '@/lib/idb'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/idb', () => {
  const actual = jest.requireActual('@/lib/idb')
  return { ...actual, listReadingsByTank: jest.fn(actual.listReadingsByTank) }
})

describe('ReportClient summary', () => {
  it('shows out-of-range and tested counts per metric', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    const now = Date.now()
    const ts = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()
    const base = { tankId: tank.id, pH: null, nitrate: null }
    await addReading({ ...base, ts: ts(1), ammonia: 0.5, nitrite: 0.25 })
    await addReading({ ...base, ts: ts(2), ammonia: 0, nitrite: 0 })
    await addReading({ ...base, ts: ts(3), ammonia: 1, nitrite: null, nitrate: 30 })
    render(
      <TankProvider>
        <ReportClient />
      </TankProvider>,
    )
    const summary = (await screen.findAllByRole('table'))[0]
    const rowFor = (label: RegExp) => within(summary).getByRole('row', { name: label })
    const cells = (label: RegExp) =>
      within(rowFor(label))
        .getAllByRole('cell')
        .map((c) => c.textContent)
    await waitFor(() => expect(cells(/ammonia/i)).toEqual(['2', '3']))
    expect(cells(/nitrite/i)).toEqual(['1', '2'])
    expect(cells(/nitrate/i)).toEqual(['1', '1'])
    expect(cells(/^pH/)).toEqual(['0', '0'])
  })

  it('does not show the previous tank readings when the next tank fails to load', async () => {
    const tankA = await createTank('First tank')
    const tankB = await createTank('Second tank')
    localStorage.setItem('activeTankId', tankA.id)
    await addReading({
      tankId: tankA.id,
      ts: new Date(Date.now() - 86_400_000).toISOString(),
      pH: 7,
      ammonia: null,
      nitrite: null,
      nitrate: null,
    })
    const head = () => document.querySelector('.report-head') as HTMLElement
    const real = jest.requireActual('@/lib/idb').listReadingsByTank
    jest
      .mocked(listReadingsByTank)
      .mockImplementation((id: string) =>
        id === tankB.id ? Promise.reject(new Error('boom')) : real(id),
      )
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <TankProvider>
        <ReportClient />
      </TankProvider>,
    )
    await waitFor(() => expect(head()).toHaveTextContent(/· 1 reading ·/))
    fireEvent.change(await screen.findByRole('combobox', { name: /tank/i }), {
      target: { value: tankB.id },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t load readings/)
    expect(head()).toHaveTextContent(/· 0 readings ·/)
    // A later successful load clears the failure
    jest.mocked(listReadingsByTank).mockImplementation(real)
    fireEvent.change(screen.getByRole('combobox', { name: /tank/i }), {
      target: { value: tankA.id },
    })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await waitFor(() => expect(head()).toHaveTextContent(/· 1 reading ·/))
    errSpy.mockRestore()
  })
})
