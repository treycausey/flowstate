import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsClient from '@/components/SettingsClient'

jest.mock('@/components/TankProvider', () => ({
  useTanks: () => ({ refresh: jest.fn(), activeTank: null }),
}))
jest.mock('@/lib/desktop', () => ({
  getDbInfo: async () => null,
  getBuildInfo: async () => null,
  revealDb: jest.fn(),
}))
jest.mock('@/lib/idb', () => ({
  exportDump: async () => ({ tanks: [{ id: 't' }], readings: [{ id: 'r' }] }),
  importDump: (d: unknown) => mockImportDump(d),
  listTanks: async () => [],
}))
const mockImportDump = jest.fn()
const mockConfirm = jest.fn()
const mockWrite = jest.fn()
const mockSave = jest.fn()
jest.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...args: unknown[]) => mockWrite(...args),
  readTextFile: jest.fn(),
  BaseDirectory: { Document: 7 },
}))
jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: () => mockSave(),
  open: jest.fn(),
  confirm: (...a: unknown[]) => mockConfirm(...a),
}))

const win = window as unknown as Record<string, unknown>
let ua: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  win.__TAURI_INTERNALS__ = {}
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete win.__TAURI_INTERNALS__
  ua?.mockRestore()
  jest.restoreAllMocks()
})

async function clickExport() {
  render(<SettingsClient />)
  fireEvent.click(await screen.findByRole('button', { name: /export backup/i }))
}

describe('JSON export inside Tauri', () => {
  it('shows an error and no success message when the write rejects (desktop)', async () => {
    mockSave.mockResolvedValue('/tmp/out.json')
    mockWrite.mockRejectedValue(new Error('forbidden path'))
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await clickExport()
    expect(await screen.findByText(/export failed: forbidden path/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Exported/)).not.toBeInTheDocument()
    expect(click).not.toHaveBeenCalled() // never the web download inside Tauri
  })

  it('reports the saved path on desktop', async () => {
    mockSave.mockResolvedValue('/tmp/out.json')
    mockWrite.mockResolvedValue(undefined)
    await clickExport()
    expect(await screen.findByText(/exported 1 tank\(s\).*to \/tmp\/out\.json/i)).toBeVisible()
  })

  it('writes to the Documents folder on iOS and says where', async () => {
    ua = jest
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    mockWrite.mockResolvedValue(undefined)
    await clickExport()
    await waitFor(() => expect(mockWrite).toHaveBeenCalled())
    const [name, , opts] = mockWrite.mock.calls[0]
    expect(name).toMatch(/^flowstate-export-\d{4}-\d{2}-\d{2}\.json$/)
    expect(opts).toEqual({ baseDir: 7 })
    expect(mockSave).not.toHaveBeenCalled()
    expect(await screen.findByText(/Files → On My iPhone → Flowstate/)).toBeVisible()
  })

  it('stays silent when the desktop save dialog is cancelled', async () => {
    mockSave.mockResolvedValue(null)
    await clickExport()
    await waitFor(() => expect(mockSave).toHaveBeenCalled())
    expect(mockWrite).not.toHaveBeenCalled()
    expect(screen.queryByText(/export/i, { selector: 'span' })).not.toBeInTheDocument()
  })
})

describe('JSON import inside Tauri', () => {
  it('confirms with the native dialog (window.confirm is dead in the iOS webview)', async () => {
    ua = jest
      .spyOn(window.navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    const windowConfirm = jest.spyOn(window, 'confirm').mockReturnValue(false)
    mockConfirm.mockResolvedValue(true)
    mockImportDump.mockResolvedValue(undefined)
    const input = document.createElement('input')
    jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tag: string) =>
        tag === 'input' ? input : Document.prototype.createElement.call(document, tag)) as never)
    jest.spyOn(input, 'click').mockImplementation(() => {})
    render(<SettingsClient />)
    fireEvent.click(await screen.findByRole('button', { name: /import backup/i }))
    expect(document.body.contains(input)).toBe(true) // stays attached while the picker is open
    Object.defineProperty(input, 'files', {
      value: [{ text: async () => JSON.stringify({ tanks: [], readings: [] }) }],
    })
    await input.onchange?.(new Event('change'))
    await waitFor(() => expect(mockImportDump).toHaveBeenCalled())
    expect(mockConfirm).toHaveBeenCalled()
    expect(windowConfirm).not.toHaveBeenCalled()
  })
})
