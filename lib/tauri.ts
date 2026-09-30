/** True inside the Tauri 2 webview (macOS desktop or iOS). The web build uses IndexedDB instead. */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

/** True on iPhone or iPad. Only meaningful for hiding desktop-only controls. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}
