import '@testing-library/jest-dom'
import { toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations as any)
// Polyfill structuredClone for fake-indexeddb
// @ts-ignore
if (typeof global.structuredClone !== 'function') {
  // @ts-ignore
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj))
}

// Minimal ResizeObserver mock for JSDOM tests where components measure width
// @ts-ignore
if (typeof global.ResizeObserver === 'undefined') {
  // @ts-ignore
  global.ResizeObserver = class {
    callback: any
    constructor(cb: any) {
      this.callback = cb
    }
    observe() {
      /* no-op */
    }
    unobserve() {
      /* no-op */
    }
    disconnect() {
      /* no-op */
    }
  }
}
