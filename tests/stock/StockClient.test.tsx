import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TankProvider } from '@/components/TankProvider'
import StockClient from '@/components/stock/StockClient'
import {
  addStock,
  addStockEvent,
  createTank,
  listStockByTank,
  listStockEventsByTank,
  setTankVolume,
} from '@/lib/idb'
import type { StockGroup } from '@/lib/models'
import { tankEvents } from '@/lib/tank/events'
import { setSearch } from '../plants/navMock'

jest.mock('next/navigation', () => jest.requireActual('../plants/navMock'))

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

let tankId = ''
let counter = 0

async function freshTank() {
  const tank = await createTank(`Stock test ${++counter}`)
  localStorage.setItem('activeTankId', tank.id)
  tankId = tank.id
  return tank
}

function seed(
  speciesId: string | null,
  name: string,
  count: number,
  extra: Partial<StockGroup> = {},
) {
  return addStock({ tankId, speciesId, name, count, addedAt: ago(10), removedAt: null, ...extra })
}

async function renderStock(images: string[] = []) {
  const view = render(
    <TankProvider>
      <StockClient images={images} />
    </TankProvider>,
  )
  // The panel renders nothing until the tank and its stock have loaded
  await screen.findByRole('navigation', { name: 'Stock sections' })
  return view
}

const dialog = () => screen.getByRole('dialog')
// The panel sits inside the app's <main> in production; a bare test body has no landmarks
const PAGE_RULES = { rules: { region: { enabled: false } } }

beforeEach(() => {
  setSearch('')
  // jsdom does not implement scrolling; the page scrolls to the top on every view change
  window.scrollTo = jest.fn()
})

describe('empty state', () => {
  it('invites the first animals and offers the catalog', async () => {
    await freshTank()
    await renderStock()
    expect(await screen.findByText('Add your fish, shrimp and snails')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your first animals' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse catalog' })).toHaveAttribute(
      'href',
      '/stock?view=learn',
    )
    expect(screen.getByRole('link', { name: 'My stock' })).toHaveAttribute('aria-current', 'page')
    // No Fed button until there is something to feed
    expect(screen.queryByRole('button', { name: 'Fed' })).not.toBeInTheDocument()
  })
})

describe('adding stock', () => {
  it('adds from the catalog in two taps with the group size prefilled', async () => {
    await freshTank()
    await renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first animals' }))

    const picker = dialog()
    expect(picker).toHaveAttribute('aria-modal', 'true')
    expect(picker.parentElement).toHaveAttribute('data-tank-ignore')
    expect(within(picker).getByText('22 species')).toBeInTheDocument()
    fireEvent.change(within(picker).getByLabelText('Search animals'), { target: { value: 'neon' } })
    expect(within(picker).getByText('1 species')).toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: /Neon tetra/ }))

    const form = dialog()
    expect(within(form).getByLabelText('Name')).toHaveValue('Neon tetra')
    expect(within(form).getByLabelText('How many')).toHaveValue('6')
    fireEvent.click(within(form).getByRole('button', { name: 'Add to tank' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const row = await screen.findByRole('link', { name: /6 × Neon tetra/ })
    const [stored] = await listStockByTank(tankId)
    expect(stored).toMatchObject({ speciesId: 'neon-tetra', name: 'Neon tetra', count: 6 })
    expect(new Date(stored.addedAt).getTime()).toBeGreaterThan(Date.now() - 60_000)
    // The first-add button is gone, so focus moves to the new row, not <body>
    await waitFor(() => expect(row).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Add stock' })).toBeInTheDocument()
  })

  it('filters the picker with pressed-state chips', async () => {
    await freshTank()
    await renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first animals' }))
    const picker = dialog()
    const safe = within(picker).getByRole('button', { name: 'Betta-safe' })
    expect(safe).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(safe)
    expect(safe).toHaveAttribute('aria-pressed', 'true')
    expect(within(picker).queryByRole('button', { name: /Guppy/ })).not.toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: 'Snails' }))
    expect(within(picker).getByText('2 species')).toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: 'Top' }))
    expect(within(picker).getByText('No animals match.')).toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: 'Clear filters' }))
    expect(within(picker).getByText('22 species')).toBeInTheDocument()
  })

  it('adds a custom animal and asks for a name first', async () => {
    await freshTank()
    await renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first animals' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add something else' }))
    const form = dialog()
    expect(within(form).getByLabelText('Name')).toHaveValue('')
    fireEvent.click(within(form).getByRole('button', { name: 'Add to tank' }))
    expect(within(form).getByText('Give the animals a name.')).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Mystery pleco' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add to tank' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('link', { name: /1 × Mystery pleco/ })).toBeInTheDocument()
    expect((await listStockByTank(tankId))[0]).toMatchObject({ speciesId: null, count: 1 })
  })

  it('steps the count with the plus and minus buttons and rejects 0', async () => {
    await freshTank()
    await renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first animals' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add something else' }))
    const form = dialog()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Snail' } })
    const count = within(form).getByLabelText('How many')
    fireEvent.click(within(form).getByRole('button', { name: 'More how many' }))
    expect(count).toHaveValue('2')
    fireEvent.click(within(form).getByRole('button', { name: 'Fewer how many' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Fewer how many' }))
    expect(count).toHaveValue('1')
    fireEvent.change(count, { target: { value: '0' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add to tank' }))
    expect(within(form).getByText('Enter a count of 1 or more.')).toBeInTheDocument()
    expect(await listStockByTank(tankId)).toEqual([])
  })

  it('warns when the tank has a betta and the newcomer is a poor match', async () => {
    await freshTank()
    await seed('betta', 'Betta', 1)
    await renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Add stock' }))
    fireEvent.change(within(dialog()).getByLabelText('Search animals'), {
      target: { value: 'guppy' },
    })
    fireEvent.click(within(dialog()).getByRole('button', { name: /Guppy/ }))
    expect(within(dialog()).getByRole('note')).toHaveTextContent(/trigger a betta/)
  })
})

describe('fed', () => {
  it('records a whole-tank feeding in one tap and drops a pellet in the scene', async () => {
    await freshTank()
    await seed('neon-tetra', 'Neon tetra', 6)
    await renderStock()
    const pellets: unknown[] = []
    const off = tankEvents.on('pellet', (p) => pellets.push(p))
    expect(await screen.findByText('Not fed yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fed' }))
    expect(await screen.findByText(/^Fed today at/)).toBeInTheDocument()
    off()
    expect(pellets).toHaveLength(1)
    const events = await listStockEventsByTank(tankId)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'fed', stockId: null })
  })
})

describe('my stock', () => {
  it('lists groups with flags for schooling and betta tankmates', async () => {
    await freshTank()
    await seed('betta', 'Betta', 1)
    await seed('guppy', 'Guppy', 4)
    await seed('neon-tetra', 'Neon tetra', 3)
    await seed('panda-corydoras', 'Panda corydoras', 6)
    await seed('cherry-shrimp', 'Cherry shrimp', 8)
    await renderStock()
    expect(await screen.findByText('22 animals')).toBeInTheDocument()
    expect(screen.getByText('· 5 groups')).toBeInTheDocument()
    const guppy = screen.getByRole('link', { name: /4 × Guppy/ }).closest('li')!
    expect(within(guppy).getByText(/poor match/)).toBeInTheDocument()
    const neon = screen.getByRole('link', { name: /3 × Neon tetra/ }).closest('li')!
    expect(
      within(neon).getByText('Neon tetras are calmer in groups of 6 or more.'),
    ).toBeInTheDocument()
    const cory = screen.getByRole('link', { name: /6 × Panda corydoras/ }).closest('li')!
    expect(within(cory).queryByRole('list', { name: 'Guidance' })).not.toBeInTheDocument()
  })

  it('shows a stocking estimate only when the tank volume is set', async () => {
    await freshTank()
    await seed('neon-tetra', 'Neon tetra', 10)
    const view = await renderStock()
    expect(await screen.findByText(/Add your tank’s volume/)).toBeInTheDocument()
    view.unmount()
    await setTankVolume(tankId, 60)
    await renderStock()
    expect(await screen.findByText(/Stocking: moderate/)).toBeInTheDocument()
    expect(screen.getByText(/rough guide, not a rule/)).toBeInTheDocument()
  })

  it('shows the latest health chip from the newest health event', async () => {
    await freshTank()
    const g = await seed('guppy', 'Guppy', 4)
    await addStockEvent({ tankId, stockId: g.id, ts: ago(3), kind: 'health', health: 'sick' })
    await addStockEvent({ tankId, stockId: g.id, ts: ago(1), kind: 'health', health: 'ok' })
    await renderStock()
    const row = (await screen.findByRole('link', { name: /4 × Guppy/ })).closest('li')!
    expect(within(row).getByText('Looks well')).toBeInTheDocument()
    expect(within(row).queryByText('Sick')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await freshTank()
    await seed('betta', 'Betta', 1)
    await seed('guppy', 'Guppy', 4)
    const view = await renderStock()
    await screen.findByRole('link', { name: /4 × Guppy/ })
    expect(await axe(view.container, PAGE_RULES)).toHaveNoViolations()
  })
})

describe('group detail', () => {
  async function openGroup(name: RegExp) {
    fireEvent.click(await screen.findByRole('link', { name }))
    return screen.findByRole('heading', { level: 2, name })
  }

  it('lost reduces the count in the same step and logs history', async () => {
    await freshTank()
    await seed('neon-tetra', 'Neon tetra', 6)
    await renderStock()
    await openGroup(/6 × Neon tetra/)
    fireEvent.click(screen.getByRole('button', { name: 'Lost' }))
    const form = dialog()
    fireEvent.click(within(form).getByRole('button', { name: 'More animals' }))
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'jumped out' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Record loss' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      await screen.findByRole('heading', { level: 2, name: /4 × Neon tetra/ }),
    ).toBeInTheDocument()
    const history = screen.getByRole('list', { name: /Events, newest first/ })
    expect(within(history).getByText('Lost 2')).toBeInTheDocument()
    expect(within(history).getByText('jumped out')).toBeInTheDocument()
    expect((await listStockByTank(tankId))[0].count).toBe(4)
  })

  it('losing every animal moves the group to left the tank', async () => {
    await freshTank()
    await seed('guppy', 'Guppy', 1)
    await renderStock()
    await openGroup(/1 × Guppy/)
    fireEvent.click(screen.getByRole('button', { name: 'Lost' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Record loss' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/None left/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lost' })).not.toBeInTheDocument()
    const [stored] = await listStockByTank(tankId)
    expect(stored).toMatchObject({ count: 0 })
    expect(stored.removedAt).toBeTruthy()
    // Adding animals back restores it
    fireEvent.click(screen.getByRole('button', { name: 'Added more' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add to group' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(async () => expect((await listStockByTank(tankId))[0].removedAt).toBeNull())
    expect(await screen.findByRole('button', { name: 'Observe' })).toBeInTheDocument()
  })

  it('observe saves a health state and note', async () => {
    await freshTank()
    await seed('panda-corydoras', 'Panda corydoras', 6)
    await renderStock()
    await openGroup(/6 × Panda corydoras/)
    fireEvent.click(screen.getByRole('button', { name: 'Observe' }))
    const form = dialog()
    // Nothing chosen yet
    fireEvent.click(within(form).getByRole('button', { name: 'Save observation' }))
    expect(within(form).getByRole('alert')).toHaveTextContent(/Pick how they look/)
    fireEvent.click(within(form).getByRole('button', { name: 'Some concern' }))
    expect(within(form).getByRole('button', { name: 'Some concern' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'clamped fins' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save observation' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const history = await screen.findByRole('list', { name: /Events, newest first/ })
    expect(within(history).getByText('clamped fins')).toBeInTheDocument()
    const [event] = await listStockEventsByTank(tankId)
    expect(event).toMatchObject({ kind: 'health', health: 'concern', note: 'clamped fins' })
  })

  it('removes and restores a group', async () => {
    await freshTank()
    await seed('guppy', 'Guppy', 3)
    await renderStock()
    await openGroup(/3 × Guppy/)
    fireEvent.click(screen.getByRole('button', { name: 'Remove from tank' }))
    expect(await screen.findByRole('button', { name: 'Restore to tank' })).toBeInTheDocument()
    expect((await listStockByTank(tankId))[0].removedAt).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restore to tank' }))
    expect(await screen.findByRole('button', { name: 'Remove from tank' })).toBeInTheDocument()
    expect((await listStockByTank(tankId))[0].removedAt).toBeNull()
  })

  it('deletes permanently only after a confirmation', async () => {
    await freshTank()
    await seed('guppy', 'Guppy', 3)
    await renderStock()
    await openGroup(/3 × Guppy/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete permanently' }))
    expect(confirm).toHaveBeenCalled()
    expect(await listStockByTank(tankId)).toHaveLength(1)
    confirm.mockReturnValueOnce(true)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete permanently' }))
    await waitFor(async () => expect(await listStockByTank(tankId)).toHaveLength(0))
    expect(await screen.findByText('Add your fish, shrimp and snails')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('edits the name and note of a count-0 group without restoring it', async () => {
    await freshTank()
    const g = await seed('guppy', 'Guppy', 1)
    const lost = await addStockEvent({
      tankId,
      stockId: g.id,
      ts: ago(1),
      kind: 'lost',
      countDelta: 1,
    })
    const removedAt = lost.ts
    setSearch(`group=${g.id}`)
    await renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(within(dialog()).getByLabelText('Name'), { target: { value: 'Old guppies' } })
    fireEvent.change(within(dialog()).getByLabelText(/Note/), { target: { value: 'Sold on' } })
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save changes' }))
    await waitFor(async () => expect((await listStockByTank(tankId))[0].name).toBe('Old guppies'))
    const [saved] = await listStockByTank(tankId)
    expect(saved.count).toBe(0)
    expect(saved.note).toBe('Sold on')
    expect(saved.removedAt).toBe(removedAt)
  })

  it('shows guidance for the group and the care card', async () => {
    await freshTank()
    await seed('betta', 'Betta', 1)
    await seed('honey-gourami', 'Honey gourami', 1)
    await renderStock()
    await openGroup(/1 × Honey gourami/)
    const flags = screen.getByRole('list', { name: 'Guidance for this group' })
    expect(within(flags).getByText(/rival|look alike/)).toBeInTheDocument()
    expect(screen.getByText('Care for Honey gourami')).toBeInTheDocument()
    expect(screen.getByText('22–28 °C (72–82 °F)')).toBeInTheDocument()
  })
})

describe('learn', () => {
  it('shows stocking basics and the catalog, and a species page', async () => {
    await freshTank()
    setSearch('view=learn')
    await renderStock()
    expect(await screen.findByText('Stocking basics', { selector: 'summary' })).toBeInTheDocument()
    expect(screen.getByText(/Cycle the tank first/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Kuhli loach/ }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Kuhli loach' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to this tank' })).toBeInTheDocument()
    expect(screen.getByText('24–30 °C (75–86 °F)')).toBeInTheDocument()
  })
})

describe('images', () => {
  it('uses the cut-out when one ships and a drawing when it does not', async () => {
    await freshTank()
    await seed('neon-tetra', 'Neon tetra', 6)
    await seed('guppy', 'Guppy', 4)
    await renderStock(['neon-tetra'])
    await screen.findByRole('link', { name: /6 × Neon tetra/ })
    // The thumbnails are decorative (alt=""), so they have no role to query by
    const images = () => [...document.querySelectorAll('img')]
    expect(images()).toHaveLength(1)
    expect(images()[0]).toHaveAttribute('src', '/tank/fish/neon-tetra.webp')
    // A failed load falls back to the drawing
    fireEvent.error(images()[0])
    expect(images()).toHaveLength(0)
  })
})

describe('fed today across midnight', () => {
  const FAKE_ONLY_CLOCK = [
    'setTimeout',
    'clearTimeout',
    'setImmediate',
    'clearImmediate',
    'nextTick',
    'queueMicrotask',
    'performance',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
  ] as const
  afterEach(() => jest.useRealTimers())

  it('turns "Fed today" into "Last fed" after midnight without new events', async () => {
    await freshTank()
    const fedAt = new Date(2026, 5, 10, 23, 50)
    await seed('neon-tetra', 'Neon tetra', 6, { addedAt: new Date(2026, 5, 1).toISOString() })
    await addStockEvent({ tankId, stockId: null, ts: fedAt.toISOString(), kind: 'fed' })
    jest.useFakeTimers({ now: new Date(2026, 5, 10, 23, 51), doNotFake: [...FAKE_ONLY_CLOCK] })
    await renderStock()
    expect(await screen.findByText(/^Fed today at/)).toBeInTheDocument()
    act(() => {
      jest.setSystemTime(new Date(2026, 5, 11, 0, 1))
      jest.advanceTimersByTime(60_000)
    })
    expect(screen.getByText(/^Last fed /)).toBeInTheDocument()
    expect(screen.queryByText(/^Fed today/)).not.toBeInTheDocument()
  })

  it('shows "Fed today" for a feeding at 00:05 after mounting at 23:50', async () => {
    await freshTank()
    await seed('neon-tetra', 'Neon tetra', 6, { addedAt: new Date(2026, 5, 1).toISOString() })
    jest.useFakeTimers({ now: new Date(2026, 5, 10, 23, 50), doNotFake: [...FAKE_ONLY_CLOCK] })
    await renderStock()
    expect(await screen.findByText('Not fed yet')).toBeInTheDocument()
    act(() => {
      jest.setSystemTime(new Date(2026, 5, 11, 0, 5))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Fed' }))
    expect(await screen.findByText(/^Fed today at/)).toBeInTheDocument()
  })
})
