const FALLBACK = 'Storage error'

function textOf(err: unknown): string | null {
  if (typeof err === 'string') return err.trim() || null
  if (err && typeof err === 'object') {
    const { message, name } = err as { message?: unknown; name?: unknown }
    if (typeof message === 'string' && message.trim()) return message
    if (typeof name === 'string' && name.trim()) return name
  }
  return null
}

/**
 * Readable text for a caught value. Never returns "null", "undefined" or "[object Object]":
 * IndexedDB can reject with a null `transaction.error`, and a bare `String(err)` prints that.
 */
export function errorText(err: unknown, fallback = FALLBACK): string {
  return textOf(err) ?? fallback
}

/**
 * The first usable error among the candidates, as an Error. IndexedDB spreads one failure over
 * `request.error`, `transaction.error` and the event target, and any of them can be null.
 */
export function storageError(...candidates: unknown[]): Error {
  for (const c of candidates) {
    if (c instanceof Error) return c
    const text = textOf(c)
    if (text) return new Error(text)
  }
  return new Error(FALLBACK)
}
