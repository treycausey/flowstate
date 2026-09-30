import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { BETTA_IMAGE } from './catalog'

/**
 * Species ids that have a cut-out, read when the page is built: the files in
 * public/tank/fish/<id>.webp, plus 'betta' when the shared betta frame exists. Passing them down
 * means a missing image never triggers a failing request. Server-only (uses node:fs).
 */
export function stockImageIds(publicDir = path.join(process.cwd(), 'public')): string[] {
  let ids: string[] = []
  try {
    ids = readdirSync(path.join(publicDir, 'tank', 'fish'))
      .filter((file) => file.endsWith('.webp'))
      .map((file) => file.slice(0, -'.webp'.length))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err // no cut-outs shipped yet
  }
  if (existsSync(path.join(publicDir, BETTA_IMAGE)) && !ids.includes('betta')) ids.push('betta')
  return ids
}
