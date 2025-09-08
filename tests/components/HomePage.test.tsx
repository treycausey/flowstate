import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'
// Avoid mounting client-only subtree; just verify server title renders
jest.mock('@/components/HomeClient', () => () => null)

describe('HomePage', () => {
  it('renders app title', () => {
    render(<HomePage />)
    expect(screen.getByText(/Aquarium Water Tracker/i)).toBeInTheDocument()
  })
})
