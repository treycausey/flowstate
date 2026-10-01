import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReportClient from '@/components/ReportClient'
import { ensureSeed } from '@/lib/idb'

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
const mockWrite = jest.fn()
jest.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...a: unknown[]) => mockWrite(...a),
  BaseDirectory: { Document: 7 },
}))
jest.mock('@tauri-apps/plugin-dialog', () => ({ save: async () => '/tmp/report.csv' }))

const win = window as unknown as Record<string, unknown>
afterEach(() => {
  delete win.__TAURI_INTERNALS__
})

it('CSV export inside Tauri surfaces a write error instead of a dead download', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  mockWrite.mockRejectedValue(new Error('disk full'))
  const tank = await ensureSeed()
  localStorage.setItem('activeTankId', tank.id)
  render(
    <TankProvider>
      <ReportClient />
    </TankProvider>,
  )
  const button = await screen.findByRole('button', { name: /export csv/i })
  win.__TAURI_INTERNALS__ = {} // data is loaded from IndexedDB; only the save path sees Tauri
  fireEvent.click(button)
  expect(await screen.findByText(/export failed: disk full/i)).toBeInTheDocument()
  expect(anchorClick).not.toHaveBeenCalled()
})

it('CSV export inside Tauri reports where the file went', async () => {
  mockWrite.mockResolvedValue(undefined)
  const tank = await ensureSeed()
  localStorage.setItem('activeTankId', tank.id)
  render(
    <TankProvider>
      <ReportClient />
    </TankProvider>,
  )
  const button = await screen.findByRole('button', { name: /export csv/i })
  win.__TAURI_INTERNALS__ = {} // data is loaded from IndexedDB; only the save path sees Tauri
  fireEvent.click(button)
  expect(await screen.findByText(/saved to \/tmp\/report\.csv/i)).toBeInTheDocument()
})
