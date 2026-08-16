import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import HomePage from '@/app/page'

jest.mock('@/components/HomeClient', () => () => null)

describe('Home page a11y', () => {
  it('has no obvious violations', async () => {
    const { container } = render(<HomePage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
