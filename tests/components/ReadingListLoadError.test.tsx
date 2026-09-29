import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { TankProvider } from '@/components/TankProvider'
import ReadingList from '@/components/ReadingList'
import { ensureSeed, listReadingsByTank } from '@/lib/idb'

jest.mock('@/lib/idb', () => {
  const actual = jest.requireActual('@/lib/idb')
  return { ...actual, listReadingsByTank: jest.fn(actual.listReadingsByTank) }
})

describe('ReadingList load failure', () => {
  it('shows a readable error and logs when loading readings fails', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    jest.mocked(listReadingsByTank).mockRejectedValueOnce(new Error('boom'))
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <TankProvider>
        <ReadingList />
      </TankProvider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t load readings/)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
