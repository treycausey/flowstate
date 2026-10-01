import { act, render, renderHook, screen } from '@testing-library/react'
import { emitReadingsChanged, events } from '@/lib/events'
import { useTankReadings } from '@/lib/useTankReadings'
import type { Reading } from '@/lib/models'

jest.mock('@/lib/idb', () => ({ listReadingsByTank: jest.fn() }))
// eslint-disable-next-line @typescript-eslint/no-require-imports
const listReadingsByTank = require('@/lib/idb').listReadingsByTank as jest.Mock

const reading = (tankId: string, pH: number): Reading => ({
  id: `${tankId}-${pH}`,
  tankId,
  ts: '2026-01-01T00:00:00.000Z',
  pH,
  ammonia: null,
  nitrite: null,
  nitrate: null,
})

function Consumer({ tankId, label }: { tankId: string | null; label: string }) {
  const { readings, failed } = useTankReadings(tankId)
  return (
    <p data-testid={label}>
      {failed ? 'failed' : readings === null ? 'null' : readings.map((r) => r.pH).join(',')}
    </p>
  )
}

const flush = () => act(() => Promise.resolve())

beforeEach(() => {
  listReadingsByTank.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

test('four consumers of one tank share a single load per change event', async () => {
  listReadingsByTank.mockResolvedValue([reading('a', 7)])
  render(
    <>
      {['n1', 'n2', 'n3', 'n4'].map((l) => (
        <Consumer key={l} tankId="a" label={l} />
      ))}
    </>,
  )
  await flush()
  expect(listReadingsByTank).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('n4')).toHaveTextContent(/^7$/)

  listReadingsByTank.mockResolvedValue([reading('a', 7), reading('a', 8)])
  act(() => emitReadingsChanged('a'))
  await flush()
  expect(listReadingsByTank).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('n1')).toHaveTextContent(/^7,8$/)
  expect(screen.getByTestId('n4')).toHaveTextContent(/^7,8$/)
})

test('events for other tanks do not reload', async () => {
  listReadingsByTank.mockResolvedValue([])
  render(<Consumer tankId="a" label="x" />)
  await flush()
  act(() => emitReadingsChanged('b'))
  await flush()
  expect(listReadingsByTank).toHaveBeenCalledTimes(1)
})

test('switching tanks never shows the previous tank readings', async () => {
  listReadingsByTank.mockImplementation(async (id: string) => [reading(id, id === 'a' ? 6.5 : 7.5)])
  const { rerender } = render(<Consumer tankId="a" label="x" />)
  await flush()
  expect(screen.getByTestId('x')).toHaveTextContent(/^6.5$/)
  let release: (r: Reading[]) => void = () => {}
  listReadingsByTank.mockImplementation(
    () => new Promise<Reading[]>((resolve) => (release = resolve)),
  )
  rerender(<Consumer tankId="b" label="x" />)
  expect(screen.getByTestId('x')).toHaveTextContent(/^null$/)
  await act(async () => release([reading('b', 7.5)]))
  expect(screen.getByTestId('x')).toHaveTextContent(/^7.5$/)
})

test('a rejected load surfaces failed to every consumer', async () => {
  listReadingsByTank.mockRejectedValue(new Error('boom'))
  render(
    <>
      <Consumer tankId="a" label="p" />
      <Consumer tankId="a" label="q" />
    </>,
  )
  await flush()
  expect(listReadingsByTank).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('p')).toHaveTextContent(/^failed$/)
  expect(screen.getByTestId('q')).toHaveTextContent(/^failed$/)
})

test('a change during a load queues exactly one follow-up load', async () => {
  let release: (r: Reading[]) => void = () => {}
  listReadingsByTank.mockImplementation(
    () => new Promise<Reading[]>((resolve) => (release = resolve)),
  )
  render(<Consumer tankId="a" label="x" />)
  act(() => {
    emitReadingsChanged('a')
    emitReadingsChanged('a')
  })
  expect(listReadingsByTank).toHaveBeenCalledTimes(1)
  listReadingsByTank.mockResolvedValue([reading('a', 9)])
  await act(async () => release([reading('a', 1)]))
  await flush()
  expect(listReadingsByTank).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('x')).toHaveTextContent(/^9$/)
})

test('unmount unsubscribes from change events', async () => {
  listReadingsByTank.mockResolvedValue([])
  const spy = jest.spyOn(events, 'removeEventListener')
  const { unmount: unmountFirst } = renderHook(() => useTankReadings('a'))
  const { unmount: unmountSecond } = renderHook(() => useTankReadings('a'))
  await flush()
  unmountFirst()
  expect(spy).not.toHaveBeenCalled() // second consumer still watching
  unmountSecond()
  expect(spy).toHaveBeenCalledWith('readings-changed', expect.any(Function))
  act(() => emitReadingsChanged('a'))
  await flush()
  expect(listReadingsByTank).toHaveBeenCalledTimes(1)
})
