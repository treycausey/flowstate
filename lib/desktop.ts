import { isTauri } from './tauri'

export type DbInfo = { dir: string; file: string }

export async function getDbInfo(): Promise<DbInfo | null> {
  try {
    const path = await import('@tauri-apps/api/path')
    const base = await path.appLocalDataDir()
    // Build file path robustly without relying on join signature differences
    const sep = base.includes('\\') ? '\\' : '/'
    const file = base.endsWith(sep) ? `${base}flowstate.db` : `${base}${sep}flowstate.db`
    return { dir: base, file }
  } catch {
    return null
  }
}

export async function revealDb(target: 'folder' | 'file' = 'folder'): Promise<void> {
  try {
    const shell = await import('@tauri-apps/api/shell')
    const info = await getDbInfo()
    if (!info) return
    const toOpen = target === 'file' ? info.file : info.dir
    await shell.open(toOpen)
  } catch {
    // noop
  }
}
