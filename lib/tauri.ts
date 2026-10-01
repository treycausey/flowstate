/** True inside the Tauri 2 webview (macOS desktop or iOS). The web build uses IndexedDB instead. */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window
}

/**
 * True on iPhone or iPad. iPadOS 13+ reports a Mac user agent, so a Mac UA with touch points
 * counts as iPad. Only meaningful for hiding desktop-only controls and choosing the file flow.
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return /Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
}
