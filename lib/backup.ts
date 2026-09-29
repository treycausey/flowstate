import { METRICS, hasAnyMetric, type Dump, type Reading, type Settings, type Tank } from './models'
import { toStorageTs } from './time'

export class BackupFormatError extends Error {}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v === '') throw new BackupFormatError(`Missing ${field}`)
  return v
}

function parseTank(v: unknown, i: number): Tank {
  if (!isObject(v)) throw new BackupFormatError(`Tank #${i + 1} is not an object`)
  const cadence = v.reminderCadence
  return {
    id: str(v.id, `tank #${i + 1} id`),
    name: str(v.name, `tank #${i + 1} name`),
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
    archivedAt: typeof v.archivedAt === 'string' ? v.archivedAt : null,
    reminderCadence:
      typeof cadence === 'number' && Number.isInteger(cadence) && cadence > 0 ? cadence : null,
  }
}

function parseReading(v: unknown, i: number): Reading {
  const label = `reading #${i + 1}`
  if (!isObject(v)) throw new BackupFormatError(`${label} is not an object`)
  let ts: string
  try {
    ts = toStorageTs(str(v.ts, `${label} ts`))
  } catch (e) {
    if (e instanceof BackupFormatError) throw e
    throw new BackupFormatError(`${label} has an invalid timestamp`)
  }
  const reading: Reading = {
    id: str(v.id, `${label} id`),
    tankId: str(v.tankId, `${label} tankId`),
    ts,
    pH: null,
    ammonia: null,
    nitrite: null,
    nitrate: null,
  }
  for (const m of METRICS) {
    const n = v[m]
    if (n === null || n === undefined) continue // metric not tested
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new BackupFormatError(`${label} has an invalid ${m} value`)
    }
    reading[m] = n
  }
  if (!hasAnyMetric(reading)) throw new BackupFormatError(`${label} has no test results`)
  if (typeof v.note === 'string' && v.note !== '') reading.note = v.note
  return reading
}

/** Validate and normalize a JSON backup before it touches storage. */
export function parseDump(data: unknown): Dump {
  if (!isObject(data) || !Array.isArray(data.tanks) || !Array.isArray(data.readings)) {
    throw new BackupFormatError('Not a Flowstate backup (expected "tanks" and "readings" arrays)')
  }
  const tanks = data.tanks.map(parseTank)
  const readings = data.readings.map(parseReading)
  const known = new Set(tanks.map((t) => t.id))
  const orphan = readings.find((r) => !known.has(r.tankId))
  if (orphan) throw new BackupFormatError(`Reading ${orphan.id} refers to an unknown tank`)
  const dump: Dump = { tanks, readings }
  if (isObject(data.settings)) dump.settings = data.settings as Settings
  return dump
}
