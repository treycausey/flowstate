import { isIos, isTauri } from '@/lib/tauri'
import { downloadText } from '@/lib/export'

export type SaveResult =
  { kind: 'saved'; where: string } | { kind: 'cancelled' } | { kind: 'downloaded' }

/**
 * Save text as a file the user can reach.
 * - Browser: a web download.
 * - Tauri desktop: the native save dialog, then a write to the chosen path.
 * - Tauri iOS: a write to the app's Documents folder (visible in Files -> On My iPhone -> Flowstate).
 * Inside Tauri this never falls back to the web download (the webview cancels it silently);
 * any failure throws so the caller can show it.
 */
export async function saveTextFile(
  filename: string,
  content: string,
  mime: string,
): Promise<SaveResult> {
  if (!isTauri()) {
    downloadText(filename, content, mime)
    return { kind: 'downloaded' }
  }
  const fs = await import('@tauri-apps/plugin-fs')
  if (isIos()) {
    await fs.writeTextFile(filename, content, { baseDir: fs.BaseDirectory.Document })
    return { kind: 'saved', where: `Files → On My iPhone → Flowstate → ${filename}` }
  }
  const dialog = await import('@tauri-apps/plugin-dialog')
  const target = await dialog.save({ defaultPath: filename })
  if (!target) return { kind: 'cancelled' }
  await fs.writeTextFile(target, content)
  return { kind: 'saved', where: target }
}

/**
 * Ask the user to confirm. Inside Tauri this uses the native dialog: `window.confirm` is not
 * wired up in the iOS webview and returns false without showing anything.
 */
export async function confirmAction(message: string): Promise<boolean> {
  if (!isTauri()) return window.confirm(message)
  const dialog = await import('@tauri-apps/plugin-dialog')
  return dialog.confirm(message, { title: 'Flowstate', kind: 'warning' })
}
