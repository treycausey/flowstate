export type DbInfo = { dir: string; file: string }
export type BuildInfo = { build: string; hash: string }

/** Database location as resolved by the Rust side (the path the app really opened). */
export async function getDbInfo(): Promise<DbInfo | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const file = await invoke<string>('app_db_path')
    const cut = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'))
    return { dir: cut > 0 ? file.slice(0, cut) : file, file }
  } catch {
    return null
  }
}

export async function getBuildInfo(): Promise<BuildInfo | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<BuildInfo>('app_build_info')
  } catch {
    return null
  }
}

export async function revealDb(): Promise<void> {
  try {
    const opener = await import('@tauri-apps/plugin-opener')
    const info = await getDbInfo()
    if (!info) return
    await opener.revealItemInDir(info.file)
  } catch (err) {
    console.error('Could not reveal the database location', err)
  }
}
