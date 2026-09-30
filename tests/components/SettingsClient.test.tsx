import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsClient from '@/components/SettingsClient'

jest.mock('@/components/TankProvider', () => ({
  useTanks: () => ({ refresh: jest.fn().mockResolvedValue(undefined), tanks: [] }),
}))
jest.mock('@/lib/desktop', () => ({ getDbInfo: async () => null, revealDb: jest.fn() }))
const mockImport = jest.fn()
jest.mock('@/lib/idb', () => ({
  exportDump: jest.fn(),
  importDump: (d: unknown) => mockImport(d),
  listTanks: async () => [{ id: 'after' }],
}))
const mockSave = jest.fn()
const mockRefresh = jest.fn()
const mockEmit = jest.fn()
jest.mock('@/lib/events', () => ({ emitReadingsChanged: (id: string) => mockEmit(id) }))
jest.mock('@/lib/tank/prefs', () => ({
  ...jest.requireActual('@/lib/tank/prefs'),
  loadTankPrefs: async () => ({ livingTank: true, hemisphere: 'north', shimmerSeen: [] }),
  saveTankPrefs: (p: unknown) => mockSave(p),
  refreshTankPrefs: () => mockRefresh(),
}))

describe('SettingsClient living-tank prefs', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rolls the toggle back when the save fails', async () => {
    mockSave.mockRejectedValue(new Error('disk full'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<SettingsClient />)
    const box = await screen.findByRole('checkbox', { name: /show living tank/i })
    await waitFor(() => expect(box).toBeChecked())
    fireEvent.click(box)
    expect(await screen.findByText(/couldn’t save that setting/i)).toBeInTheDocument()
    expect(box).toBeChecked()
  })

  it('tells the tank host to re-read prefs after a backup import', async () => {
    mockImport.mockResolvedValue(undefined)
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    const input = document.createElement('input')
    jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) =>
        tag === 'input' ? input : Document.prototype.createElement.call(document, tag)) as never)
    jest.spyOn(input, 'click').mockImplementation(() => {})
    render(<SettingsClient />)
    fireEvent.click(await screen.findByRole('button', { name: /import backup/i }))
    const file = { text: async () => JSON.stringify({ tanks: [], readings: [] }) }
    Object.defineProperty(input, 'files', { value: [file] })
    await input.onchange?.(new Event('change'))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it('emits change events for the tanks present after import', async () => {
    mockImport.mockResolvedValue(undefined)
    mockRefresh.mockResolvedValue(undefined)
    const input = await pickImport()
    await input.onchange?.(new Event('change'))
    await waitFor(() => expect(mockEmit).toHaveBeenCalledWith('after'))
  })

  it('reports an accurate message when the post-import refresh fails', async () => {
    mockImport.mockResolvedValue(undefined)
    mockRefresh.mockRejectedValue(new Error('boom'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const input = await pickImport()
    await input.onchange?.(new Event('change'))
    expect(await screen.findByText(/imported, but couldn’t refresh/i)).toBeInTheDocument()
    expect(screen.queryByText(/nothing was changed/i)).not.toBeInTheDocument()
  })
})

async function pickImport() {
  jest.restoreAllMocks()
  jest.spyOn(window, 'confirm').mockReturnValue(true)
  const input = document.createElement('input')
  jest
    .spyOn(document, 'createElement')
    .mockImplementation(((tag: string) =>
      tag === 'input' ? input : Document.prototype.createElement.call(document, tag)) as never)
  jest.spyOn(input, 'click').mockImplementation(() => {})
  render(<SettingsClient />)
  fireEvent.click(await screen.findByRole('button', { name: /import backup/i }))
  const file = { text: async () => JSON.stringify({ tanks: [], readings: [] }) }
  Object.defineProperty(input, 'files', { value: [file] })
  return input
}

describe('SettingsClient export', () => {
  it('shows a readable error when reading the data fails, never "null"', async () => {
    const { exportDump } = jest.requireMock('@/lib/idb') as { exportDump: jest.Mock }
    exportDump.mockRejectedValueOnce(null)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<SettingsClient />)
    fireEvent.click(await screen.findByRole('button', { name: /export backup/i }))
    const msg = await screen.findByText(/Export failed/)
    expect(msg).toHaveClass('danger')
    expect(msg).toHaveTextContent(/^Export failed: Storage error\.$/)
  })

  it('says the backup includes plants', async () => {
    render(<SettingsClient />)
    expect(await screen.findByText(/every tank, reading, plant/)).toBeInTheDocument()
  })
})
