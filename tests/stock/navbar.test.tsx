import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import NavBar from '@/components/NavBar'
import { TankProvider } from '@/components/TankProvider'
import { createTank } from '@/lib/idb'

jest.mock('next/navigation', () => ({
  usePathname: () => '/stock',
}))
jest.mock('@/components/ThemeToggle', () => ({ __esModule: true, default: () => null }))

describe('tab bar', () => {
  it('has a Stock tab between Charts and Plants, current on /stock', async () => {
    await createTank('Nav tank')
    render(
      <TankProvider>
        <NavBar />
      </TankProvider>,
    )
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual([
      'Log',
      'Charts',
      'Stock',
      'Plants',
      'Report',
      'Settings',
    ])
    const stock = within(nav).getByRole('link', { name: 'Stock' })
    expect(stock).toHaveAttribute('href', '/stock')
    expect(stock).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Plants' })).not.toHaveAttribute('aria-current')
  })
})
