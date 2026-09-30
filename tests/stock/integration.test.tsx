import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ReportClient from '@/components/ReportClient'
import SettingsClient from '@/components/SettingsClient'
import TankStatus from '@/components/TankStatus'
import { TankProvider } from '@/components/TankProvider'
import StockClient from '@/components/stock/StockClient'
import { StockStatusView } from '@/components/stock/StockStatusLine'
import { addReading, addStock, addStockEvent, createTank, listTanks } from '@/lib/idb'
import type { StockEvent, StockGroup } from '@/lib/models'
import { setSearch } from '../plants/navMock'

jest.mock('next/navigation', () => jest.requireActual('../plants/navMock'))
jest.mock('@/components/ThemeToggle', () => ({ __esModule: true, default: () => null }))

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

beforeEach(() => {
  setSearch('')
  window.scrollTo = jest.fn()
})

describe('create tank → add stock → fed → status line and report', () => {
  it('flows from the Stock tab to the Log status line and the printable report', async () => {
    const tank = await createTank('Flow tank')
    localStorage.setItem('activeTankId', tank.id)
    await addReading({ tankId: tank.id, ts: ago(1), pH: 7, ammonia: 0, nitrite: 0, nitrate: 12 })

    // 1. Add a group from the catalog and feed the tank
    const view = render(
      <TankProvider>
        <StockClient />
      </TankProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first animals' }))
    fireEvent.change(screen.getByLabelText('Search animals'), { target: { value: 'panda' } })
    fireEvent.click(screen.getByRole('button', { name: /Panda corydoras/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to tank' }))
    await screen.findByRole('link', { name: /6 × Panda corydoras/ })
    fireEvent.click(screen.getByRole('button', { name: 'Fed' }))
    await screen.findByText(/^Fed today at/)
    // A second group, so the status line counts animals across groups
    fireEvent.click(screen.getByRole('button', { name: 'Add stock' }))
    fireEvent.change(screen.getByLabelText('Search animals'), { target: { value: 'harlequin' } })
    fireEvent.click(screen.getByRole('button', { name: /Harlequin rasbora/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add to tank' }))
    await screen.findByRole('link', { name: /6 × Harlequin rasbora/ })
    view.unmount()

    // 2. The Log screen's status line and the report both show it
    render(
      <TankProvider>
        <TankStatus />
        <ReportClient />
      </TankProvider>,
    )
    const line = await screen.findByRole('link', { name: /Stock: 12 animals/ })
    expect(line).toHaveAttribute('href', '/stock')
    expect(line).toHaveTextContent('Stock: 12 animals · fed today')

    const heading = await screen.findByRole('heading', { name: 'Stock' })
    const section = heading.closest('section')!
    expect(within(section).getByText(/12/)).toBeInTheDocument()
    expect(section).toHaveTextContent(/last fed/)
    const table = within(section).getByRole('table')
    const row = within(table).getByRole('row', { name: /Panda corydoras/ })
    expect(within(row).getByText('6')).toBeInTheDocument()
    expect(within(row).getByText('Bottom')).toBeInTheDocument()
    expect(within(row).getByText('Not noted')).toBeInTheDocument()
  })

  it('leaves the report and the status line alone for a tank without stock', async () => {
    const tank = await createTank('No stock')
    localStorage.setItem('activeTankId', tank.id)
    await addReading({ tankId: tank.id, ts: ago(1), pH: 7, ammonia: 0, nitrite: 0, nitrate: 5 })
    render(
      <TankProvider>
        <TankStatus />
        <ReportClient />
      </TankProvider>,
    )
    await screen.findByRole('heading', { name: 'Out-of-range summary' })
    await screen.findByText('Nearly cycled')
    expect(screen.queryByRole('heading', { name: 'Stock' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Stock:/ })).not.toBeInTheDocument()
  })

  it('does not list removed or emptied groups in the report, and prints flags', async () => {
    const tank = await createTank('Report flags')
    localStorage.setItem('activeTankId', tank.id)
    const base = { tankId: tank.id, addedAt: ago(20), removedAt: null }
    await addStock({ ...base, speciesId: 'betta', name: 'Betta', count: 1 })
    await addStock({ ...base, speciesId: 'guppy', name: 'Guppy', count: 3 })
    const gone = await addStock({ ...base, speciesId: 'neon-tetra', name: 'Gone neons', count: 1 })
    await addStockEvent({
      tankId: tank.id,
      stockId: gone.id,
      ts: ago(2),
      kind: 'lost',
      countDelta: 1,
    })
    render(
      <TankProvider>
        <ReportClient />
      </TankProvider>,
    )
    const heading = await screen.findByRole('heading', { name: 'Stock' })
    const section = heading.closest('section')!
    expect(within(section).queryByText('Gone neons')).not.toBeInTheDocument()
    expect(section).toHaveTextContent(/poor match/)
    expect(section).toHaveTextContent('no feedings logged')
  })
})

describe('stock status line', () => {
  const group = (count: number, extra: Partial<StockGroup> = {}): StockGroup => ({
    id: `g${count}${Math.random()}`,
    tankId: 't',
    speciesId: null,
    name: 'x',
    count,
    addedAt: ago(5),
    removedAt: null,
    ...extra,
  })
  const fed = (ts: string): StockEvent => ({ id: ts, tankId: 't', stockId: null, ts, kind: 'fed' })

  it('says "Stock: 11 animals · fed today" and links to the Stock tab', () => {
    const now = new Date(2026, 8, 30, 20, 0)
    render(
      <StockStatusView
        groups={[group(6), group(5), group(3, { removedAt: ago(1) })]}
        events={[fed(new Date(2026, 8, 30, 8, 10).toISOString())]}
        now={now}
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/stock')
    expect(link).toHaveTextContent('Stock: 11 animals · fed today')
  })

  it('says not fed today, with a singular animal', () => {
    render(
      <StockStatusView
        groups={[group(1)]}
        events={[fed(new Date(2026, 8, 29, 8, 10).toISOString())]}
        now={new Date(2026, 8, 30, 20, 0)}
      />,
    )
    expect(screen.getByRole('link')).toHaveTextContent('Stock: 1 animal · not fed today')
  })

  it('renders nothing for an empty tank', () => {
    const { container } = render(
      <StockStatusView groups={[group(2, { removedAt: ago(1) })]} events={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('settings: tank volume', () => {
  it('saves the active tank volume in litres with a gallons helper', async () => {
    const tank = await createTank('Volume tank')
    localStorage.setItem('activeTankId', tank.id)
    render(
      <TankProvider>
        <SettingsClient />
      </TankProvider>,
    )
    const field = await screen.findByLabelText('Tank volume')
    fireEvent.change(field, { target: { value: '60' } })
    expect(screen.getByText('about 15.9 US gal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Volume saved.')
    await waitFor(async () =>
      expect((await listTanks()).find((t) => t.id === tank.id)?.volumeL).toBe(60),
    )
    // Invalid input does not save
    fireEvent.change(field, { target: { value: 'big' } })
    fireEvent.submit(field.closest('form')!)
    expect(await screen.findByText(/Enter a volume in litres/)).toBeInTheDocument()
    expect((await listTanks()).find((t) => t.id === tank.id)?.volumeL).toBe(60)
  })
})

describe('stock events survive on the page after a reload', () => {
  it('keeps the fed line and the events in storage', async () => {
    const tank = await createTank('Reload tank')
    localStorage.setItem('activeTankId', tank.id)
    await addStock({
      tankId: tank.id,
      speciesId: 'guppy',
      name: 'Guppy',
      count: 3,
      addedAt: ago(3),
      removedAt: null,
    })
    await addStockEvent({
      tankId: tank.id,
      stockId: null,
      ts: new Date().toISOString(),
      kind: 'fed',
    })
    render(
      <TankProvider>
        <StockClient />
      </TankProvider>,
    )
    expect(await screen.findByText(/^Fed today at/)).toBeInTheDocument()
  })
})
