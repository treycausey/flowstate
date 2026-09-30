import 'fake-indexeddb/auto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TankProvider } from '@/components/TankProvider'
import PlantsClient from '@/components/plants/PlantsClient'
import {
  addPlant,
  addPlantCheck,
  addReading,
  createTank,
  listPlantChecksByTank,
  listPlantsByTank,
} from '@/lib/idb'
import type { Plant } from '@/lib/models'
import { currentSearch, setSearch } from './navMock'

jest.mock('next/navigation', () => jest.requireActual('./navMock'))

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

let tankId = ''
let counter = 0

async function freshTank(readings = true) {
  const tank = await createTank(`Plants test ${++counter}`)
  localStorage.setItem('activeTankId', tank.id)
  if (readings) {
    await addReading({
      tankId: tank.id,
      ts: ago(1),
      pH: 7,
      ammonia: 0,
      nitrite: 0,
      nitrate: 0,
    })
  }
  tankId = tank.id
  return tank
}

function seedPlant(extra: Partial<Plant> = {}) {
  return addPlant({
    tankId,
    speciesId: 'amazon-sword',
    name: 'Amazon sword',
    placement: 'background',
    plantedAt: ago(10),
    removedAt: null,
    ...extra,
  })
}

async function renderPlants() {
  const view = render(
    <TankProvider>
      <PlantsClient />
    </TankProvider>,
  )
  // The panel renders nothing until the tank and its plants have loaded
  await screen.findByRole('navigation', { name: 'Plants sections' })
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
  it('invites the first plant and offers the catalog', async () => {
    await freshTank()
    await renderPlants()
    expect(await screen.findByText('Nothing planted yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add your first plant' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse catalog' })).toHaveAttribute(
      'href',
      '/plants?view=learn',
    )
    expect(screen.getByRole('link', { name: 'My plants' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('adding a plant', () => {
  it('adds from the catalog in a few taps, with placement and date prefilled', async () => {
    await freshTank()
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first plant' }))

    const picker = dialog()
    expect(picker).toHaveAttribute('aria-modal', 'true')
    expect(picker.parentElement).toHaveAttribute('data-tank-ignore')
    expect(within(picker).getByText('24 plants')).toBeInTheDocument()
    fireEvent.change(within(picker).getByLabelText('Search plants'), { target: { value: 'swo' } })
    expect(within(picker).getByText('1 plant')).toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: /Amazon sword/ }))

    // Second step: everything is already filled in
    const form = dialog()
    expect(within(form).getByLabelText('Name')).toHaveValue('Amazon sword')
    expect(within(form).getByRole('button', { name: 'Background' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(form).getByRole('button', { name: 'Midground' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect((within(form).getByLabelText('Planted') as HTMLInputElement).value).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Add plant' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const group = await screen.findByRole('region', { name: /Background/ })
    expect(within(group).getByText('Amazon sword')).toBeInTheDocument()
    expect(within(group).getByText("Echinodorus grisebachii 'Bleherae'")).toBeInTheDocument()
    expect(screen.getByText(/Planted today/)).toBeInTheDocument()

    const [stored] = await listPlantsByTank(tankId)
    expect(stored).toMatchObject({
      speciesId: 'amazon-sword',
      name: 'Amazon sword',
      placement: 'background',
    })
    expect(new Date(stored.plantedAt).getTime()).toBeGreaterThan(Date.now() - 60_000)
    // The first-plant button is gone, so focus moves to the new plant's row, not <body>
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute('href', `/plants?plant=${stored.id}`),
    )
    expect(screen.getByRole('button', { name: 'Add plant' })).toBeInTheDocument()
  })

  it('adds a custom plant and asks for a name first', async () => {
    await freshTank()
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first plant' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add a custom plant' }))

    const form = dialog()
    expect(within(form).getByRole('heading', { name: 'Custom plant' })).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Add plant' }))
    expect(within(form).getByText('Give the plant a name.')).toBeInTheDocument()
    expect(within(form).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Mystery stem' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Floating' }))
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'from a friend' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add plant' }))

    const group = await screen.findByRole('region', { name: /Floating/ })
    expect(within(group).getByText('Mystery stem')).toBeInTheDocument()
    expect(within(group).getByText('Custom plant')).toBeInTheDocument()
    const [stored] = await listPlantsByTank(tankId)
    expect(stored).toMatchObject({
      speciesId: null,
      name: 'Mystery stem',
      placement: 'floating',
      note: 'from a friend',
    })
  })

  it('refuses a planting date in the future', async () => {
    await freshTank()
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first plant' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Java moss/ }))
    const form = dialog()
    const next = new Date(Date.now() + 3 * DAY)
    const pad = (n: number) => String(n).padStart(2, '0')
    fireEvent.change(within(form).getByLabelText('Planted'), {
      target: {
        value: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T10:00`,
      },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Add plant' }))
    expect(within(form).getByText('Can’t be in the future.')).toBeInTheDocument()
    expect(await listPlantsByTank(tankId)).toHaveLength(0)
  })

  it('filters the catalog with pressed-state chips and can clear them', async () => {
    await freshTank()
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first plant' }))
    const picker = dialog()

    const lowLight = within(picker).getByRole('button', { name: 'Low light' })
    expect(lowLight).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(lowLight)
    expect(lowLight).toHaveAttribute('aria-pressed', 'true')
    const lowCount = Number(
      /^(\d+) plants$/.exec(within(picker).getByRole('status').textContent ?? '')?.[1],
    )
    expect(lowCount).toBeGreaterThan(3)
    expect(lowCount).toBeLessThan(24)

    fireEvent.change(within(picker).getByLabelText('Search plants'), { target: { value: 'zzz' } })
    expect(within(picker).getByText('No plants match.')).toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: 'Clear filters' }))
    expect(within(picker).getByText('24 plants')).toBeInTheDocument()
    expect(within(picker).getByRole('button', { name: 'Low light' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(within(picker).getByRole('button', { name: 'Floating' }))
    fireEvent.click(within(picker).getByRole('button', { name: 'Betta-friendly' }))
    expect(within(picker).getByText('3 plants')).toBeInTheDocument()
  })

  it('closes on Escape and hands focus back to the button that opened it', async () => {
    await freshTank()
    await renderPlants()
    const opener = await screen.findByRole('button', { name: 'Add your first plant' })
    opener.focus()
    fireEvent.click(opener)
    expect(within(dialog()).getByLabelText('Search plants')).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  it('keeps Tab inside the dialog', async () => {
    await freshTank()
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first plant' }))
    const picker = dialog()
    const close = within(picker).getByRole('button', { name: 'Close' })
    const custom = within(picker).getByRole('button', { name: 'Add a custom plant' })
    custom.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(custom).toHaveFocus()
  })
})

describe('my plants', () => {
  it('groups plants by placement with health, age and check due', async () => {
    await freshTank()
    const sword = await seedPlant()
    await seedPlant({
      speciesId: 'anubias-nana',
      name: 'Anubias on wood',
      placement: 'epiphyte',
      plantedAt: ago(40),
    })
    await seedPlant({
      speciesId: 'dwarf-sagittaria',
      name: 'Sagittaria',
      placement: 'foreground',
      plantedAt: ago(3),
    })
    await addPlantCheck({
      plantId: sword.id,
      tankId,
      ts: ago(2),
      health: 'struggling',
      symptoms: ['pinholes'],
    })
    await renderPlants()

    const headings = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent)
    expect(headings).toEqual(['Foreground 1', 'Background 1', 'Epiphyte 1'])
    expect(screen.getByText('3 plants')).toBeInTheDocument()

    const swordRow = screen.getByRole('link', { name: /Amazon sword/ })
    expect(within(swordRow).getByText('Struggling')).toHaveClass('health-chip--caution')
    expect(within(swordRow).getByText('Planted 10 days ago')).toBeInTheDocument()
    expect(within(swordRow).queryByText('Check due')).not.toBeInTheDocument()

    const anubiasRow = screen.getByRole('link', { name: /Anubias on wood/ })
    expect(within(anubiasRow).getByText('Not checked')).toBeInTheDocument()
    expect(within(anubiasRow).getByText('Check due')).toBeInTheDocument()
    expect(within(anubiasRow).getByText('Anubias barteri var. nana')).toBeInTheDocument()

    const sagRow = screen.getByRole('link', { name: /Sagittaria/ })
    expect(within(sagRow).queryByText('Check due')).not.toBeInTheDocument()
    // 1 struggling + 1 check due
    expect(screen.getByRole('status')).toHaveTextContent('3 plants · 1 struggling · 1 check due')
  })

  it('opens a plant from its row', async () => {
    await freshTank()
    const sword = await seedPlant()
    await renderPlants()
    fireEvent.click(await screen.findByRole('link', { name: /Amazon sword/ }))
    expect(currentSearch()).toBe(`plant=${sword.id}`)
    expect(await screen.findByRole('heading', { name: 'Amazon sword' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← My plants' })).toBeInTheDocument()
  })

  it('returns to My plants for the new tank when the tank changes on a plant page', async () => {
    const other = await createTank(`Plants test ${++counter}`)
    await freshTank()
    const sword = await seedPlant()
    setSearch(`plant=${sword.id}`)
    await renderPlants()
    expect(await screen.findByRole('heading', { name: 'Amazon sword' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Tank' }), {
      target: { value: other.id },
    })
    expect(await screen.findByText('Nothing planted yet')).toBeInTheDocument()
    expect(screen.queryByText('Plant not found')).not.toBeInTheDocument()
    expect(currentSearch()).toBe('')
  })
})

describe('checking health', () => {
  it('saves a check, shows the diagnosis with the water test behind it, and can dismiss it', async () => {
    await freshTank() // latest nitrate reads 0
    const sword = await seedPlant()
    setSearch(`plant=${sword.id}`)
    await renderPlants()

    fireEvent.click(await screen.findByRole('button', { name: 'Check health' }))
    const form = dialog()
    // Symptoms typical for this plant come first
    const symptomChips = within(
      within(form).getByRole('group', { name: /Any of these/ }),
    ).getAllByRole('button')
    expect(symptomChips[0]).toHaveTextContent('Yellowing old leaves')
    expect(symptomChips).toHaveLength(12)

    // Health is required
    fireEvent.click(within(form).getByRole('button', { name: 'Save check' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Choose how the plant looks.')

    const health = within(form).getByRole('button', { name: 'Struggling' })
    fireEvent.click(health)
    expect(health).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(form).getByRole('button', { name: 'Yellowing old leaves' }))
    expect(within(form).getByText(/oldest, lowest leaves turn yellow/)).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Trimmed' }))
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'lower leaves' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save check' }))

    const card = await screen.findByRole('region', { name: 'What may be going on' })
    expect(within(card).getByText('Nitrogen shortage')).toBeInTheDocument()
    expect(within(card).getByText(/Nitrate tested 0 ppm on/)).toBeInTheDocument()
    expect(card).toHaveTextContent(/often|likely|may help/i)

    const [check] = await listPlantChecksByTank(tankId)
    expect(check).toMatchObject({
      plantId: sword.id,
      health: 'struggling',
      symptoms: ['yellowing-old-leaves'],
      action: 'trimmed',
      note: 'lower leaves',
    })
    // History and the state chip update
    const history = screen.getByRole('list', { name: 'Checks, newest first' })
    expect(within(history).getByText('Struggling')).toBeInTheDocument()
    expect(within(history).getByText('Yellowing old leaves · Trimmed')).toBeInTheDocument()

    fireEvent.click(within(card).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('region', { name: 'What may be going on' })).not.toBeInTheDocument()
  })

  it('skips the diagnosis when no symptoms were picked', async () => {
    await freshTank()
    const sword = await seedPlant()
    setSearch(`plant=${sword.id}`)
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Check health' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Thriving' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      await screen.findByText('Thriving', { selector: '.plant-state .health-chip' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'What may be going on' })).not.toBeInTheDocument()
    expect(screen.queryByText('Check due')).not.toBeInTheDocument()
  })

  it('tells a new crypt that melts to leave the roots alone', async () => {
    await freshTank()
    const crypt = await seedPlant({
      speciesId: 'cryptocoryne-wendtii',
      name: 'Crypt',
      placement: 'midground',
      plantedAt: ago(6),
    })
    setSearch(`plant=${crypt.id}`)
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Check health' }))
    const form = dialog()
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
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save check' }))
    const card = await screen.findByRole('region', { name: 'What may be going on' })
    expect(within(card).getByText('Crypt melt after planting')).toBeInTheDocument()
    expect(card).toHaveTextContent(/Leave the roots/)
  })
})

describe('removing, restoring and deleting', () => {
  it('removes a plant into a collapsed list and restores it', async () => {
    await freshTank()
    const sword = await seedPlant()
    setSearch(`plant=${sword.id}`)
    await renderPlants()

    fireEvent.click(await screen.findByRole('button', { name: 'Remove from tank' }))
    expect(await screen.findByText(/It stays in your history/)).toBeInTheDocument()
    expect((await listPlantsByTank(tankId))[0].removedAt).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Check health' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '← My plants' }))
    const summary = await screen.findByText('Removed (1)')
    expect(summary.closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText('No plants in the tank now.')).toBeInTheDocument()

    fireEvent.click(within(summary.closest('details')!).getByRole('link', { name: /Amazon sword/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore to tank' }))
    await waitFor(async () => expect((await listPlantsByTank(tankId))[0].removedAt).toBeNull())
    expect(await screen.findByRole('button', { name: 'Check health' })).toBeInTheDocument()
  })

  it('deletes for good only after confirming, taking the history along', async () => {
    await freshTank()
    const sword = await seedPlant()
    await addPlantCheck({ plantId: sword.id, tankId, ts: ago(1), health: 'ok', symptoms: [] })
    setSearch(`plant=${sword.id}`)
    await renderPlants()

    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete permanently' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/can’t be undone/))
    expect(await listPlantsByTank(tankId)).toHaveLength(1)

    confirm.mockReturnValue(true)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Delete permanently' }))
    await waitFor(async () => expect(await listPlantsByTank(tankId)).toHaveLength(0))
    expect(await listPlantChecksByTank(tankId)).toHaveLength(0)
    expect(await screen.findByText('Nothing planted yet')).toBeInTheDocument()
    expect(currentSearch()).toBe('')
    confirm.mockRestore()
  })

  it('edits name and placement', async () => {
    await freshTank()
    const sword = await seedPlant()
    setSearch(`plant=${sword.id}`)
    await renderPlants()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const form = dialog()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Big sword' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Midground' }))
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('heading', { name: 'Big sword' })).toBeInTheDocument()
    const [stored] = await listPlantsByTank(tankId)
    expect(stored).toMatchObject({ name: 'Big sword', placement: 'midground' })
    // Untouched planted date is kept exactly
    expect(stored.plantedAt).toBe(sword.plantedAt)
  })
})

describe('learn', () => {
  it('shows the plant basics and the whole catalog, then a species page that adds to the tank', async () => {
    await freshTank()
    setSearch('view=learn')
    await renderPlants()

    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page')
    const basics = await screen.findByRole('region', { name: 'Plant basics' })
    expect(within(basics).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5)
    expect(within(basics).getAllByRole('listitem').length).toBeLessThanOrEqual(7)
    expect(basics).toHaveTextContent(/Bettas breathe air/)
    expect(screen.getByText('24 plants')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /Java fern/ }))
    expect(currentSearch()).toBe('species=java-fern')
    expect(await screen.findByRole('heading', { name: 'Java fern' })).toBeInTheDocument()
    expect(screen.getByText('20–28 °C (68–82 °F)')).toBeInTheDocument()
    expect(screen.getByText(/Do not bury the rhizome/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Common problems' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add to this tank' }))
    const form = dialog()
    expect(within(form).getByLabelText('Name')).toHaveValue('Java fern')
    expect(within(form).getByRole('button', { name: 'Epiphyte' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(form).getByRole('button', { name: 'Add plant' }))
    // Lands on the new plant
    await waitFor(() => expect(currentSearch()).toMatch(/^plant=/))
    expect(await screen.findByRole('button', { name: 'Check health' })).toBeInTheDocument()
    expect((await listPlantsByTank(tankId))[0].speciesId).toBe('java-fern')
  })

  it('says so for a species that is not in the catalog', async () => {
    await freshTank()
    setSearch('species=unicorn-fern')
    await renderPlants()
    expect(await screen.findByRole('heading', { name: 'Plant not found' })).toBeInTheDocument()
  })

  it('remembers a collapsed basics section', async () => {
    await freshTank()
    setSearch('view=learn')
    const { unmount } = await renderPlants()
    const details = (await screen.findByText('Plant basics', { selector: 'summary' })).closest(
      'details',
    )!
    expect(details).toHaveAttribute('open')
    details.open = false
    fireEvent(details, new Event('toggle'))
    expect(localStorage.getItem('plantBasicsOpen')).toBe('closed')
    unmount()
    await renderPlants()
    expect(
      (await screen.findByText('Plant basics', { selector: 'summary' })).closest('details'),
    ).not.toHaveAttribute('open')
    localStorage.removeItem('plantBasicsOpen')
  })
})

describe('accessibility', () => {
  it('has no detectable violations in the list, a plant, the picker and the check dialog', async () => {
    await freshTank()
    const sword = await seedPlant()
    await renderPlants()
    expect(await axe(document.body, PAGE_RULES)).toHaveNoViolations()

    fireEvent.click(await screen.findByRole('button', { name: 'Add plant' }))
    expect(await axe(document.body, PAGE_RULES)).toHaveNoViolations()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))

    act(() => setSearch(`plant=${sword.id}`))
    fireEvent.click(await screen.findByRole('button', { name: 'Check health' }))
    expect(await axe(document.body, PAGE_RULES)).toHaveNoViolations()
  })
})
