import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReportClient from '@/components/ReportClient'
import { addReading, ensureSeed } from '@/lib/idb'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

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
})
