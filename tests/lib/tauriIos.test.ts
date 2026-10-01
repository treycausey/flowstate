import { isIos } from '@/lib/tauri'

function withNavigator(userAgent: string, maxTouchPoints: number, run: () => void) {
  const ua = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  })
  try {
    run()
  } finally {
    ua.mockRestore()
    delete (window.navigator as unknown as Record<string, unknown>).maxTouchPoints
  }
}

describe('isIos', () => {
  it('detects iPhone', () =>
    withNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, () =>
      expect(isIos()).toBe(true),
    ))
  it('detects iPadOS that reports a Mac user agent', () =>
    withNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, () =>
      expect(isIos()).toBe(true),
    ))
  it('is false on a Mac without touch', () =>
    withNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, () =>
      expect(isIos()).toBe(false),
    ))
})
