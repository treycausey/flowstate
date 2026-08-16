import 'fake-indexeddb/auto'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TankProvider } from '@/components/TankProvider'
import HomeClient from '@/components/HomeClient'
import { ensureSeed } from '@/lib/idb'

describe('HomeClient a11y', () => {
  it('has no obvious violations', async () => {
    const tank = await ensureSeed()
    localStorage.setItem('activeTankId', tank.id)
    const { container } = render(
      <TankProvider>
        <HomeClient />
      </TankProvider>,
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
