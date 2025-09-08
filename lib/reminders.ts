type ReminderState = {
  snoozeUntil?: string | null
  lastSkipAt?: string | null
}

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
  localStorage.setItem(key(tankId), JSON.stringify(state))
}

export function nextDue(lastTsISO: string | null, cadenceDays: number, from: Date = new Date()) {
  if (!cadenceDays || cadenceDays <= 0) return null
  if (!lastTsISO) return from
  const last = new Date(lastTsISO)
  const next = new Date(last.getTime() + cadenceDays * 24 * 60 * 60 * 1000)
  return next
}

export function isDue(
  lastTsISO: string | null,
  cadenceDays: number | null | undefined,
  tankId: string,
  now: Date = new Date(),
) {
  if (!cadenceDays || cadenceDays <= 0) return false
  const due = nextDue(lastTsISO, cadenceDays, now)
  if (!due) return false
  const state = loadState(tankId)
  if (state.snoozeUntil && new Date(state.snoozeUntil) > now) return false
  return due <= now
}

export function snooze24h(tankId: string, now: Date = new Date()) {
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const state = loadState(tankId)
  state.snoozeUntil = until
  saveState(tankId, state)
}

export function skipOnce(tankId: string, cadenceDays: number, lastTsISO: string | null, now: Date = new Date()) {
  const next = nextDue(lastTsISO, cadenceDays, now)
  const state = loadState(tankId)
  state.snoozeUntil = next ? next.toISOString() : null
  state.lastSkipAt = now.toISOString()
  saveState(tankId, state)
}

