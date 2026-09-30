// Pure triggers for the tank's easter eggs.

/** True when typing turned a note into one that contains "betta" (case-insensitive). */
export function noteSummonsBetta(previous: string, next: string): boolean {
  const has = (s: string) => s.toLowerCase().includes('betta')
  return has(next) && !has(previous)
}

/** Dec 31 23:59 through Jan 1 00:10, local time. */
export function isNewYearWindow(date: Date): boolean {
  const m = date.getMonth()
  const d = date.getDate()
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (m === 11 && d === 31) return minutes >= 23 * 60 + 59
  if (m === 0 && d === 1) return minutes <= 10
  return false
}

export const SHIMMER_AT_READINGS = 100

/** The golden shimmer plays once per tank, the first time it holds 100 readings. */
export function shouldShimmer(tankId: string, readingCount: number, seen: string[]): boolean {
  return readingCount >= SHIMMER_AT_READINGS && !seen.includes(tankId)
}
