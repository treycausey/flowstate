// Time helpers: ISO with local offset and locale display formatting

function pad(n: number, width = 2) {
  return n.toString().padStart(width, '0')
}

export function offsetStringFromMinutes(mins: number) {
  const sign = mins > 0 ? '-' : '+' // JS getTimezoneOffset: minutes behind UTC
  const abs = Math.abs(mins)
  const hh = Math.floor(abs / 60)
  const mm = abs % 60
  return `${sign}${pad(hh)}:${pad(mm)}`
}

export function toISOWithOffset(d: Date) {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  const ms = pad(d.getMilliseconds(), 3)
  const offset = offsetStringFromMinutes(d.getTimezoneOffset())
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}.${ms}${offset}`
}

/**
 * Canonical storage form for reading timestamps: UTC ISO 8601 (`...Z`).
 * Storage indexes and range queries compare `ts` as strings, which is only
 * chronologically correct when every value shares the same offset.
 */
export function toStorageTs(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid timestamp: ${String(input)}`)
  return d.toISOString()
}

/** Value for an <input type="datetime-local"> in the user's local time. */
export function toDatetimeLocalValue(d: Date) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

/** Parse an <input type="datetime-local"> value as local time; null when invalid. */
export function fromDatetimeLocalValue(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function tsMillis(ts: string) {
  return new Date(ts).getTime()
}

export function compareTs(a: { ts: string }, b: { ts: string }) {
  return tsMillis(a.ts) - tsMillis(b.ts)
}

export function formatLocal(d: Date, locale?: string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(
    locale || undefined,
    opts || { dateStyle: 'medium', timeStyle: 'short' },
  ).format(d)
}
