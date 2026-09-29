export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  // Tauri 1.x exposes __TAURI_IPC__, 2.x sets a more refined env; keep simple heuristic
  return (
    '__TAURI_IPC__' in window ||
    (typeof navigator !== 'undefined' && /Tauri/i.test(navigator.userAgent || ''))
  )
}
