import { isTauri } from '@/lib/tauri'

describe('isTauri', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  it('is false in a plain browser', () => {
    expect(isTauri()).toBe(false)
  })

  it('is true when the Tauri 2 internals are present (desktop and iOS)', () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })

  it('ignores the Tauri 1 global', () => {
    ;(window as unknown as Record<string, unknown>).__TAURI_IPC__ = {}
    expect(isTauri()).toBe(false)
    delete (window as unknown as Record<string, unknown>).__TAURI_IPC__
  })
})
