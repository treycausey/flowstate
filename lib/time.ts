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

export function formatLocal(d: Date, locale?: string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(
    locale || undefined,
    opts || { dateStyle: 'medium', timeStyle: 'short' },
  ).format(d)
}
