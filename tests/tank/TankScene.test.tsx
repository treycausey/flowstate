import { render } from '@testing-library/react'
import TankScene from '@/components/tank/TankScene'
import { NEUTRAL_WATER } from '@/lib/tank/waterState'

afterEach(() => {
  delete document.documentElement.dataset.tankPhase
})

describe('TankScene without WebGL2 (jsdom)', () => {
  it('renders nothing and does not throw', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<TankScene water={NEUTRAL_WATER} />)
    expect(container).toBeEmptyDOMElement()
    expect(document.querySelector('canvas')).toBeNull()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('accepts an exclusion rect and unmounts cleanly', () => {
    const { unmount, container } = render(
      <TankScene
        water={{ ...NEUTRAL_WATER, mood: 'stressed', haze: 0.6 }}
        exclusion={{ left: 10, top: 10, right: 300, bottom: 700 }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(() => unmount()).not.toThrow()
    expect(document.documentElement.dataset.tankPhase).toBeDefined()
  })

  it('still publishes the phase for the page CSS', () => {
    const { unmount } = render(<TankScene water={NEUTRAL_WATER} />)
    expect(['dawn', 'day', 'dusk', 'night']).toContain(document.documentElement.dataset.tankPhase)
    unmount()
    // Cleanup must not remove it: a re-run would blink the night theme.
    expect(['dawn', 'day', 'dusk', 'night']).toContain(document.documentElement.dataset.tankPhase)
  })
})
