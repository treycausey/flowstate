import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import QuickEntry from '@/components/QuickEntry'
import { ensureSeed, findMostRecentReading, addReading, listReadingsByTank } from '@/lib/idb'

function renderWithProvider(ui: React.ReactNode) {
  return render(<TankProvider>{ui}</TankProvider>)
}

describe('QuickEntry', () => {
  it('saves a reading for the active tank', async () => {
    const tank = await ensureSeed()
    // Ensure provider picks the same active tank
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    fireEvent.change(screen.getByLabelText(/^pH$/), { target: { value: '7.2' } })
    fireEvent.change(screen.getByLabelText(/^Ammonia \(/), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/^Nitrite \(/), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/^Nitrate \(/), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(
      async () => {
        const readings = await listReadingsByTank(tank.id)
        expect(readings.length).toBeGreaterThan(0)
        const last = readings[readings.length - 1]
        expect(last?.pH).toBe(7.2)
      },
      { timeout: 3000 },
    )
  })

  it('prefills with last values', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    await addReading({
      tankId: tank.id,
      ts: new Date().toISOString(),
      pH: 7.1,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
      note: 'seed',
    })
    renderWithProvider(<QuickEntry />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /use last values/i })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: /use last values/i }))
    await waitFor(
      () => {
        expect(screen.getByLabelText(/^pH$/)).toHaveValue('7.1')
      },
      { timeout: 3000 },
    )
  })

  it('shows Instructions modal and closes', async () => {
    renderWithProvider(<QuickEntry />)
    // Open
    fireEvent.click(screen.getByRole('button', { name: /instructions/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /instructions/i })).toBeInTheDocument()
    // Close
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('starts a 30-second timer and ticks down outside modal', async () => {
    jest.useFakeTimers()
    renderWithProvider(<QuickEntry />)
    fireEvent.click(screen.getByRole('button', { name: /instructions/i }))
    const startBtn = await screen.findByRole('button', { name: /NO3 \(30 seconds\)/i })
    fireEvent.click(startBtn)
    // Close modal
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Timers panel visible outside
    expect(screen.getByText(/Timers/i)).toBeInTheDocument()
    expect(screen.getByText(/NO3 \(30 seconds\)/i)).toBeInTheDocument()
    expect(screen.getByText(/00:30/)).toBeInTheDocument()
    // Advance 1s and assert it ticks
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(await screen.findByText(/00:29/)).toBeInTheDocument()
    jest.useRealTimers()
  })

  it('renders a progress ring for timers', async () => {
    jest.useFakeTimers()
    renderWithProvider(<QuickEntry />)
    fireEvent.click(screen.getByRole('button', { name: /instructions/i }))
    // Start two different timers
    fireEvent.click(await screen.findByRole('button', { name: /NO3 \(30 seconds\)/i }))
    fireEvent.click(await screen.findByRole('button', { name: /NO3 \(1 minute\)/i }))
    // Close modal and verify two rings exist
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    const rings = await screen.findAllByTestId('timer-ring')
    expect(rings.length).toBeGreaterThanOrEqual(2)
    jest.useRealTimers()
  })
})

describe('QuickEntry validation', () => {
  it('saves a partial reading with untested metrics as null', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    const before = (await listReadingsByTank(tank.id)).length
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.change(screen.getByLabelText(/^Ammonia \(/), { target: { value: '0.5' } })
    fireEvent.change(screen.getByLabelText(/^Nitrite \(/), { target: { value: '0.25' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Reading saved.')).toBeInTheDocument()
    const all = await listReadingsByTank(tank.id)
    expect(all).toHaveLength(before + 1)
    const last = await findMostRecentReading(tank.id)
    expect(last).toMatchObject({ pH: null, ammonia: 0.5, nitrite: 0.25, nitrate: null })
    confirmSpy.mockRestore()
  })

  it('rejects an all-blank form with a form-level error', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    const before = (await listReadingsByTank(tank.id)).length
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Enter at least one test result.')).toBeInTheDocument()
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^pH$/)).toHaveFocus()
    expect(await listReadingsByTank(tank.id)).toHaveLength(before)
  })

  it('still shows a per-field error for a typed invalid value', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    fireEvent.change(screen.getByLabelText(/^pH$/), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Must be 5–9')).toBeInTheDocument()
    expect(screen.getByLabelText(/^pH$/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/^pH$/)).toHaveFocus()
  })

  it('confirms a successful save inline and keeps kit values like 0.25 ppm', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.change(screen.getByLabelText(/^pH$/), { target: { value: '7.6' } })
    fireEvent.change(screen.getByLabelText(/^Ammonia \(/), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText(/^Nitrite \(/), { target: { value: '0.25' } })
    fireEvent.change(screen.getByLabelText(/^Nitrate \(/), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Reading saved.')).toBeInTheDocument()
    const last = await findMostRecentReading(tank.id)
    expect(last?.nitrite).toBe(0.25)
    expect(screen.getByLabelText(/^pH$/)).toHaveValue('')
    confirmSpy.mockRestore()
  })
})

describe('QuickEntry kit chips', () => {
  it('fills a field from a chip, saves, and clears on a second tap', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    const chip = screen.getByRole('button', { name: 'NH3 0.5' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(screen.getByLabelText(/^Ammonia \(/)).toHaveValue('0.5')
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'NH3 0.25' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    // Tapping again clears back to not tested
    fireEvent.click(chip)
    expect(screen.getByLabelText(/^Ammonia \(/)).toHaveValue('')
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    // Chips only, nothing typed
    fireEvent.click(screen.getByRole('button', { name: 'NH3 0.5' }))
    fireEvent.click(screen.getByRole('button', { name: 'NO2 0.25' }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Reading saved.')).toBeInTheDocument()
    const last = await findMostRecentReading(tank.id)
    expect(last).toMatchObject({ pH: null, ammonia: 0.5, nitrite: 0.25, nitrate: null })
    confirmSpy.mockRestore()
  })

  it('reflects a typed value and switches pH to the high-range kit', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    fireEvent.change(screen.getByLabelText(/^Nitrate \(/), { target: { value: '20' } })
    expect(screen.getByRole('button', { name: 'NO3 20' })).toHaveAttribute('aria-pressed', 'true')

    expect(screen.queryByRole('button', { name: 'pH 8.8' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'High-range kit' }))
    fireEvent.click(screen.getByRole('button', { name: 'pH 8.8' }))
    expect(screen.getByLabelText(/^pH$/)).toHaveValue('8.8')
    expect(screen.queryByRole('button', { name: 'pH 7.0' })).not.toBeInTheDocument()
  })
})

describe('QuickEntry typed input', () => {
  it('rejects unparseable text instead of saving it as not tested', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const before = (await listReadingsByTank(tank.id)).length
    fireEvent.change(screen.getByLabelText(/^pH$/), { target: { value: '7.2' } })
    fireEvent.change(screen.getByLabelText(/^Ammonia \(/), { target: { value: 'o.5' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Enter a number')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Ammonia \(/)).toHaveAttribute('aria-invalid', 'true')
    expect(await listReadingsByTank(tank.id)).toHaveLength(before)
  })

  it('accepts a comma decimal', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    fireEvent.change(screen.getByLabelText(/^Ammonia \(/), { target: { value: '0,25' } })
    expect(screen.getByRole('button', { name: 'NH3 0.25' })).toHaveAttribute('aria-pressed', 'true')
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText('Reading saved.')).toBeInTheDocument()
    expect(await findMostRecentReading(tank.id)).toMatchObject({ ammonia: 0.25 })
    confirmSpy.mockRestore()
  })

  it('steps a value with the arrow keys', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const ammonia = screen.getByLabelText(/^Ammonia \(/)
    fireEvent.keyDown(ammonia, { key: 'ArrowUp' })
    expect(ammonia).toHaveValue('0')
    fireEvent.keyDown(ammonia, { key: 'ArrowUp' })
    expect(ammonia).toHaveValue('0.25')
    fireEvent.keyDown(ammonia, { key: 'ArrowDown' })
    expect(ammonia).toHaveValue('0')
  })
})

describe('QuickEntry chip keyboard navigation', () => {
  it('makes each chip row one Tab stop, with arrow keys moving between chips', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())

    // Focus order after the pH input: the pH row has exactly one tabbable chip
    const phGroup = screen.getByRole('group', { name: 'pH kit values' })
    const tabbable = Array.from(phGroup.querySelectorAll<HTMLElement>('button')).filter(
      (b) => b.tabIndex === 0,
    )
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]).toHaveAccessibleName('pH 6.0')

    const first = screen.getByRole('button', { name: 'NH3 0' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'NH3 0.25' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(screen.getByRole('button', { name: 'NH3 8' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'NH3 8' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(screen.getByRole('button', { name: 'NH3 0' })).toHaveFocus()

    // The selected chip is the tab stop
    fireEvent.change(screen.getByLabelText(/^Nitrate \(/), { target: { value: '20' } })
    expect(screen.getByRole('button', { name: 'NO3 20' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'NO3 0' })).toHaveAttribute('tabindex', '-1')
  })

  it('keeps focus on a chip when clearing a high-range pH value', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    fireEvent.change(screen.getByLabelText(/^pH$/), { target: { value: '8.0' } })
    const chip = screen.getByRole('button', { name: 'pH 8.0' })
    chip.focus()
    // Space on a focused button fires a click
    fireEvent.click(chip)
    expect(screen.getByLabelText(/^pH$/)).toHaveValue('')
    const phGroup = screen.getByRole('group', { name: 'pH kit values' })
    expect(phGroup.contains(document.activeElement)).toBe(true)
    expect(document.activeElement?.tagName).toBe('BUTTON')
  })

  it('has a distinct label per group and puts the range toggle before the pH input', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const names = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))
    expect(names).toEqual([
      'pH kit values',
      'Ammonia kit values',
      'Nitrite kit values',
      'Nitrate kit values',
    ])
    const toggle = screen.getByRole('button', { name: 'High-range kit' })
    const ph = screen.getByLabelText(/^pH$/)
    expect(toggle.compareDocumentPosition(ph) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('reaches the next control from the pH input in at most 2 Tab stops', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    renderWithProvider(<QuickEntry />)
    await waitFor(() => expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled())
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>('input, button, select, textarea, [tabindex]'),
    ).filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled)
    const from = focusable.indexOf(screen.getByLabelText(/^pH$/))
    const ammoniaInput = focusable.indexOf(screen.getByLabelText(/^Ammonia \(/))
    expect(ammoniaInput - from).toBeLessThanOrEqual(2)
  })
})
