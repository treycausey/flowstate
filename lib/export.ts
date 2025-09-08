import type { Reading, Tank } from './models'

export function readingsToCsv(tank: Tank, readings: Reading[]) {
  const header = 'tank,name,ts,pH,ammonia_ppm,nitrite_ppm,nitrate_ppm,note'
  const lines = readings.map((r) =>
    [
      tank.id,
      escapeCsv(tank.name),
      r.ts,
      fixDecimals(r.pH),
      fixDecimals(r.ammonia),
      fixDecimals(r.nitrite),
      fixDecimals(r.nitrate),
      r.note ? escapeCsv(r.note) : '',
    ].join(','),
  )
  return [header, ...lines].join('\n')
}

function escapeCsv(s: string) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function fixDecimals(n: number) {
  return Number.isFinite(n) ? String(Number(n.toFixed(3))) : ''
}

