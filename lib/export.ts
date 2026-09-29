import type { Reading, Tank } from './models'

export function readingsToCsv(tank: Tank, readings: Reading[]) {
  const header = 'tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note'
  const lines = readings.map((r) =>
    [
      escapeCsv(tank.id),
      escapeCsv(tank.name),
      r.ts,
      fixDecimals(r.pH),
      fixDecimals(r.ammonia),
      fixDecimals(r.nitrite),
      fixDecimals(r.nitrate),
      r.note ? escapeCsv(r.note) : '',
    ].join(','),
  )
  return [header, ...lines].join('\n') + '\n'
}

function escapeCsv(s: string) {
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function fixDecimals(n: number) {
  return Number.isFinite(n) ? String(Number(n.toFixed(3))) : ''
}

/** Filesystem-safe filename fragment from a user-supplied name. */
export function safeFilePart(name: string) {
  const cleaned = name
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'tank'
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later: some browsers cancel the download if revoked synchronously
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
