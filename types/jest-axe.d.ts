// Minimal typings for jest-axe (no @types package installed)
declare module 'jest-axe' {
  export type AxeResults = { violations: unknown[] }
  export function axe(
    html: Element | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>
  export const toHaveNoViolations: jest.ExpectExtendMap
}

declare namespace jest {
  interface Matchers<R> {
    toHaveNoViolations(): R
  }
}
