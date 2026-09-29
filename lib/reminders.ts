export type ReminderState = {
  snoozeUntil?: string | null
  lastSkipAt?: string | null
  lastNotifiedDue?: string | null // due date (ISO) we already showed a system notification for
}

const DAY_MS = 24 * 60 * 60 * 1000
const key = (tankId: string) => `reminderState:${tankId}`

export function loadState(tankId: string): ReminderState {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key(tankId))
    return raw ? (JSON.parse(raw) as ReminderState) : {}
  } catch {
    return {}
  }
}

export function saveState(tankId: string, state: ReminderState) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key(tankId), JSON.stringify(state))
  } catch {
    // storage full or unavailable; reminders degrade to stateless
  }
}

export function nextDue(lastTsISO: string | null, cadenceDays: number, from: Date = new Date()) {
  if (!cadenceDays || cadenceDays <= 0) return null
  if (!lastTsISO) return from
  const last = new Date(lastTsISO)
  if (Number.isNaN(last.getTime())) return from
  return new Date(last.getTime() + cadenceDays * DAY_MS)
}

/** When the reminder will next surface, accounting for snooze/skip. Null when disabled. */
export function effectiveDue(
  lastTsISO: string | null,
  cadenceDays: number | null | undefined,
  tankId: string,
  now: Date = new Date(),
): Date | null {
  if (!cadenceDays || cadenceDays <= 0) return null
  const due = nextDue(lastTsISO, cadenceDays, now)
  if (!due) return null
  const { snoozeUntil } = loadState(tankId)
  const snoozed = snoozeUntil ? new Date(snoozeUntil) : null
  if (snoozed && snoozed > due) return snoozed
  return due
}

export function isDue(
  lastTsISO: string | null,
  cadenceDays: number | null | undefined,
  tankId: string,
  now: Date = new Date(),
) {
  const due = effectiveDue(lastTsISO, cadenceDays, tankId, now)
  return !!due && due <= now
}

export function snooze24h(tankId: string, now: Date = new Date()) {
  const state = loadState(tankId)
  state.snoozeUntil = new Date(now.getTime() + DAY_MS).toISOString()
  saveState(tankId, state)
}

/** Skip the current reminder cycle: hide it until the next cadence boundary after `now`. */
export function skipOnce(
  tankId: string,
  cadenceDays: number,
  lastTsISO: string | null,
  now: Date = new Date(),
) {
  if (!cadenceDays || cadenceDays <= 0) return
  const cadenceMs = cadenceDays * DAY_MS
  let next = nextDue(lastTsISO, cadenceDays, now)!.getTime()
  if (next <= now.getTime()) {
    const cycles = Math.floor((now.getTime() - next) / cadenceMs) + 1
    next += cycles * cadenceMs
  }
  const state = loadState(tankId)
  state.snoozeUntil = new Date(next).toISOString()
  state.lastSkipAt = now.toISOString()
  saveState(tankId, state)
}

/** Returns true (and records it) the first time a given due date should raise a system notification. */
export function shouldNotify(tankId: string, due: Date) {
  const state = loadState(tankId)
  const dueISO = due.toISOString()
  if (state.lastNotifiedDue === dueISO) return false
  state.lastNotifiedDue = dueISO
  saveState(tankId, state)
  return true
}

/** Parse a custom cadence input; whole days from 1 to 365. */
export function parseCadence(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 365) return null
  return n
}
