import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TankProvider, useTanks } from '@/components/TankProvider'
import PlantsClient from '@/components/plants/PlantsClient'
import { PlantsStatusView } from '@/components/plants/PlantsStatusLine'
import ReportClient from '@/components/ReportClient'
import TankStatus from '@/components/TankStatus'
import { addPlant, addPlantCheck, addReading, createTank } from '@/lib/idb'
import { emitPlantsChanged } from '@/lib/events'
import type { Plant, PlantCheck } from '@/lib/models'
import { usePlantVitality } from '@/lib/plants/vitality'
import { setSearch } from './navMock'

jest.mock('next/navigation', () => jest.requireActual('./navMock'))

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

beforeEach(() => {
  setSearch('')
  window.scrollTo = jest.fn()
})

describe('create tank → add plant → check → report', () => {
  it('flows from the Plants tab to the status line and the printable report', async () => {
    const tank = await createTank('Flow tank')
    localStorage.setItem('activeTankId', tank.id)
    await addReading({ tankId: tank.id, ts: ago(1), pH: 7, ammonia: 0, nitrite: 0, nitrate: 12 })

    // 1. Add a plant from the catalog
    const view = render(
      <TankProvider>
        <PlantsClient />
      </TankProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first plant' }))
    fireEvent.change(screen.getByLabelText('Search plants'), { target: { value: 'wendtii' } })
    fireEvent.click(screen.getByRole('button', { name: /Cryptocoryne wendtii/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add plant' }))
    fireEvent.click(await screen.findByRole('link', { name: /Cryptocoryne wendtii/ }))

    // 2. Check its health with a symptom
    fireEvent.click(await screen.findByRole('button', { name: 'Check health' }))
    const form = screen.getByRole('dialog')
    fireEvent.click(
      within(within(form).getByRole('group', { name: 'How does it look?' })).getByRole('button', {
        name: 'Melting',
      }),
    )
    fireEvent.click(
      within(within(form).getByRole('group', { name: /Any of these/ })).getByRole('button', {
        name: 'Melting',
      }),
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Save check' }))
    // Freshly planted crypt that melts: the reassuring diagnosis comes first
    expect(await screen.findByText('Crypt melt after planting')).toBeInTheDocument()
    view.unmount()

    // 3. The Log screen's status line and the report both show it
    render(
      <TankProvider>
        <TankStatus />
        <ReportClient />
      </TankProvider>,
    )
    const line = await screen.findByRole('link', { name: /Plants: 1/ })
    expect(line).toHaveAttribute('href', '/plants')
    expect(line).toHaveTextContent('Plants: 1 · 1 struggling')

    const heading = await screen.findByRole('heading', { name: 'Plants' })
    const table = within(heading.closest('section')!).getByRole('table')
    const row = within(table).getByRole('row', { name: /Cryptocoryne wendtii/ })
    expect(within(row).getByText('Melting')).toHaveClass('plants-report__health--danger')
    expect(within(row).getByText('Midground')).toBeInTheDocument()
    expect(within(row).queryByText('Not checked')).not.toBeInTheDocument()
  })

  it('leaves the report and the status line alone for a tank without plants', async () => {
    const tank = await createTank('No plants')
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
    expect(screen.queryByRole('heading', { name: 'Plants' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Plants:/ })).not.toBeInTheDocument()
  })

  it('does not list removed plants in the report', async () => {
    const tank = await createTank('Removed only')
    localStorage.setItem('activeTankId', tank.id)
    await addPlant({
      tankId: tank.id,
      speciesId: 'java-moss',
      name: 'Gone moss',
      placement: 'epiphyte',
      plantedAt: ago(40),
      removedAt: ago(2),
    })
    render(
      <TankProvider>
        <ReportClient />
      </TankProvider>,
    )
    await screen.findByRole('heading', { name: 'Out-of-range summary' })
    expect(screen.queryByText('Gone moss')).not.toBeInTheDocument()
  })
})

describe('plants status line', () => {
  const plant = (id: string, days: number, extra: Partial<Plant> = {}): Plant => ({
    id,
    tankId: 't',
    speciesId: null,
    name: id,
    placement: 'midground',
    plantedAt: ago(days),
    removedAt: null,
    ...extra,
  })
  const check = (plantId: string, health: PlantCheck['health'], days = 1): PlantCheck => ({
    id: `c-${plantId}-${days}`,
    plantId,
    tankId: 't',
    ts: ago(days),
    health,
    symptoms: [],
  })

  it('summarises count, struggling plants and checks due, and links to the Plants tab', () => {
    const plants = [
      plant('a', 90),
      plant('b', 90),
      plant('c', 90),
      plant('d', 5),
      plant('e', 5),
      plant('f', 5),
    ]
    const checks = [check('a', 'struggling'), check('b', 'melting'), check('c', 'ok', 30)]
    render(<PlantsStatusView plants={plants} checks={checks} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/plants')
    // a struggling, b melting (counted with struggling), c due, d-f fresh and unchecked
    expect(link).toHaveTextContent('Plants: 6 · 2 struggling · 1 check due')
  })

  it('names dead plants and stays short when everything is fine', () => {
    const { rerender } = render(
      <PlantsStatusView plants={[plant('a', 5), plant('b', 5)]} checks={[check('a', 'dead')]} />,
    )
    expect(screen.getByRole('link')).toHaveTextContent('Plants: 2 · 1 dead')
    rerender(
      <PlantsStatusView
        plants={[plant('a', 5), plant('b', 5)]}
        checks={[check('a', 'thriving'), check('b', 'ok')]}
      />,
    )
    expect(screen.getByRole('link')).toHaveTextContent(/^Plants: 2\s*→?$/)
  })

  it('renders nothing without active plants', () => {
    const { container } = render(
      <PlantsStatusView plants={[plant('a', 5, { removedAt: ago(1) })]} checks={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('usePlantVitality (hook for the living tank)', () => {
  function Probe() {
    const { activeTankId } = useTanks()
    const vitality = usePlantVitality(activeTankId)
    return <output>{vitality === null ? 'none' : vitality.toFixed(2)}</output>
  }

  it('follows the tank: none, then the average of the latest checks as they change', async () => {
    const tank = await createTank('Vitality')
    localStorage.setItem('activeTankId', tank.id)
    render(
      <TankProvider>
        <Probe />
      </TankProvider>,
    )
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('none'))

    const a = await addPlant({
      tankId: tank.id,
      speciesId: null,
      name: 'A',
      placement: 'midground',
      plantedAt: ago(5),
    })
    const b = await addPlant({
      tankId: tank.id,
      speciesId: null,
      name: 'B',
      placement: 'midground',
      plantedAt: ago(5),
    })
    await act(async () => emitPlantsChanged(tank.id))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0.75'))

    await addPlantCheck({
      plantId: a.id,
      tankId: tank.id,
      ts: ago(0),
      health: 'thriving',
      symptoms: [],
    })
    await addPlantCheck({
      plantId: b.id,
      tankId: tank.id,
      ts: ago(0),
      health: 'dead',
      symptoms: [],
    })
    await act(async () => emitPlantsChanged(tank.id))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0.50'))
  })
})
