import {
  METRICS,
  hasAnyMetric,
  type Dump,
  type Plant,
  type PlantCheck,
  type Reading,
  type Settings,
  type Tank,
} from './models'
import { isHealth, isSymptomId } from './plants/health'
import { ACTIONS, PLACEMENTS, type PlantAction, type Placement } from './plants/types'
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

function optionalStr(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function utc(v: unknown, label: string, field: string): string {
  try {
    return toStorageTs(str(v, `${label} ${field}`))
  } catch (e) {
    if (e instanceof BackupFormatError) throw e
    throw new BackupFormatError(`${label} has an invalid ${field}`)
  }
}

function parsePlant(v: unknown, i: number): Plant {
  const label = `plant #${i + 1}`
  if (!isObject(v)) throw new BackupFormatError(`${label} is not an object`)
  if (typeof v.placement !== 'string' || !(PLACEMENTS as readonly string[]).includes(v.placement)) {
    throw new BackupFormatError(`${label} has an invalid placement`)
  }
  const plant: Plant = {
    id: str(v.id, `${label} id`),
    tankId: str(v.tankId, `${label} tankId`),
    speciesId: optionalStr(v.speciesId),
    name: str(v.name, `${label} name`),
    placement: v.placement as Placement,
    plantedAt: utc(v.plantedAt, label, 'plantedAt'),
    removedAt: v.removedAt ? utc(v.removedAt, label, 'removedAt') : null,
  }
  const note = optionalStr(v.note)
  if (note) plant.note = note
  return plant
}

function parsePlantCheck(v: unknown, i: number): PlantCheck {
  const label = `plant check #${i + 1}`
  if (!isObject(v)) throw new BackupFormatError(`${label} is not an object`)
  if (!isHealth(v.health)) throw new BackupFormatError(`${label} has an invalid health value`)
  const rawSymptoms = v.symptoms ?? []
  if (!Array.isArray(rawSymptoms) || !rawSymptoms.every(isSymptomId)) {
    throw new BackupFormatError(`${label} has an invalid symptom`)
  }
  const check: PlantCheck = {
    id: str(v.id, `${label} id`),
    plantId: str(v.plantId, `${label} plantId`),
    tankId: str(v.tankId, `${label} tankId`),
    ts: utc(v.ts, label, 'ts'),
    health: v.health,
    symptoms: rawSymptoms,
  }
  if (v.action !== undefined && v.action !== null) {
    if (typeof v.action !== 'string' || !(ACTIONS as readonly string[]).includes(v.action)) {
      throw new BackupFormatError(`${label} has an invalid action`)
    }
    check.action = v.action as PlantAction
  }
  const note = optionalStr(v.note)
  if (note) check.note = note
  return check
}

function list(v: unknown, field: string): unknown[] {
  if (v === undefined || v === null) return [] // backups made before plants existed
  if (!Array.isArray(v)) throw new BackupFormatError(`"${field}" must be an array`)
  return v
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
  const plants = list(data.plants, 'plants').map(parsePlant)
  const plantIds = new Set(plants.map((p) => p.id))
  const orphanPlant = plants.find((p) => !known.has(p.tankId))
  if (orphanPlant) throw new BackupFormatError(`Plant ${orphanPlant.id} refers to an unknown tank`)
  const plantChecks = list(data.plantChecks, 'plantChecks').map(parsePlantCheck)
  const orphanCheck = plantChecks.find((c) => !plantIds.has(c.plantId) || !known.has(c.tankId))
  if (orphanCheck) {
    throw new BackupFormatError(`Plant check ${orphanCheck.id} refers to an unknown plant or tank`)
  }
  const plantTank = new Map(plants.map((p) => [p.id, p.tankId]))
  const strayCheck = plantChecks.find((c) => plantTank.get(c.plantId) !== c.tankId)
  if (strayCheck) {
    throw new BackupFormatError(
      `Plant check ${strayCheck.id} is on a different tank than its plant`,
    )
  }
  const dump: Dump = { tanks, readings, plants, plantChecks }
  if (isObject(data.settings)) dump.settings = data.settings as Settings
  return dump
}
