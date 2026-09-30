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
}))
const mockSave = jest.fn()
const mockRefresh = jest.fn()
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
})
