import type { Dump, Plant, PlantCheck, Reading, Settings, Tank } from './models'
import * as idb from './idb-browser'
import * as sqlite from './sqlite'
import { isTauri } from './tauri'
import { compareTs, toStorageTs } from './time'
import { parseDump } from './backup'

// Resolve lazily so the choice is made in the browser, not at module evaluation during SSR
const api = () => (isTauri() ? sqlite : idb)

const byCreatedAt = (a: Tank, b: Tank) => a.createdAt.localeCompare(b.createdAt)

// Tanks
export async function listTanks(): Promise<Tank[]> {
  return (await api().listTanks()).slice().sort(byCreatedAt)
}

export function createTank(name: string, reminderCadence: number | null = null): Promise<Tank> {
  return api().createTank(name.trim(), reminderCadence)
}

export function renameTank(id: string, name: string): Promise<void> {
  return api().renameTank(id, name.trim())
}

export function archiveTank(id: string): Promise<void> {
  return api().archiveTank(id)
}

export function setTankReminderCadence(id: string, days: number | null): Promise<void> {
  return api().setTankReminderCadence(id, days)
}

// Readings. Timestamps are normalized to UTC so string-ordered indexes stay chronological.
export function addReading(input: Omit<Reading, 'id'> & { id?: string }): Promise<Reading> {
  return api().addReading({ ...input, ts: toStorageTs(input.ts) })
}

export function updateReading(reading: Reading): Promise<void> {
  return api().updateReading({ ...reading, ts: toStorageTs(reading.ts) })
}

export function deleteReading(id: string): Promise<void> {
  return api().deleteReading(id)
}

/** All readings for a tank, oldest first. */
export async function listReadingsByTank(tankId: string): Promise<Reading[]> {
  return (await api().listReadingsByTank(tankId)).slice().sort(compareTs)
}

export async function listReadingsByTankInRange(
  tankId: string,
  fromISO: string,
  toISO: string,
): Promise<Reading[]> {
  const rows = await api().listReadingsByTankInRange(
    tankId,
    toStorageTs(fromISO),
    toStorageTs(toISO),
  )
  return rows.slice().sort(compareTs)
}

export async function findMostRecentReading(tankId: string): Promise<Reading | undefined> {
  const all = await listReadingsByTank(tankId)
  return all.length > 0 ? all[all.length - 1] : undefined
}

/** Readings within ±30 minutes of `tsISO`, optionally ignoring one reading (e.g. the one being edited). */
export async function listReadingsWithinHour(
  tankId: string,
  tsISO: string,
  excludeId?: string,
): Promise<Reading[]> {
  const center = new Date(tsISO).getTime()
  const start = new Date(center - 30 * 60 * 1000).toISOString()
  const end = new Date(center + 30 * 60 * 1000).toISOString()
  const rows = await listReadingsByTankInRange(tankId, start, end)
  return excludeId ? rows.filter((r) => r.id !== excludeId) : rows
}

// Plants. Timestamps are normalized to UTC like readings. Archiving a tank keeps its plants,
// exactly as it keeps its readings.
export function addPlant(input: Omit<Plant, 'id'> & { id?: string }): Promise<Plant> {
  return api().addPlant({
    ...input,
    name: input.name.trim(),
    plantedAt: toStorageTs(input.plantedAt),
    removedAt: input.removedAt ? toStorageTs(input.removedAt) : null,
  })
}

export function updatePlant(plant: Plant): Promise<void> {
  return api().updatePlant({
    ...plant,
    name: plant.name.trim(),
    plantedAt: toStorageTs(plant.plantedAt),
    removedAt: plant.removedAt ? toStorageTs(plant.removedAt) : null,
  })
}

/** Permanently deletes the plant and its health checks. */
export function deletePlant(id: string): Promise<void> {
  return api().deletePlant(id)
}

/** Every plant of a tank, removed ones included, oldest planted first. */
export async function listPlantsByTank(tankId: string): Promise<Plant[]> {
  return (await api().listPlantsByTank(tankId))
    .slice()
    .sort((a, b) => a.plantedAt.localeCompare(b.plantedAt))
}

export function addPlantCheck(
  input: Omit<PlantCheck, 'id'> & { id?: string },
): Promise<PlantCheck> {
  return api().addPlantCheck({ ...input, ts: toStorageTs(input.ts) })
}

/** All plant checks of a tank, oldest first. */
export async function listPlantChecksByTank(tankId: string): Promise<PlantCheck[]> {
  return (await api().listPlantChecksByTank(tankId)).slice().sort(compareTs)
}

// Settings
export function getSettings(): Promise<Settings | undefined> {
  return api().getSettings()
}

export function setSettings(value: Settings): Promise<void> {
  return api().setSettings(value)
}

// Seed/init: create the first tank on first run. Concurrent callers share one creation.
let seeding: Promise<Tank> | null = null
export function ensureSeed(): Promise<Tank> {
  if (!seeding) {
    seeding = (async () => {
      const tanks = await listTanks()
      if (tanks.length > 0) return tanks.find((t) => !t.archivedAt) ?? tanks[0]
      return createTank('My Tank')
    })().finally(() => {
      seeding = null
    })
  }
  return seeding
}

export function exportDump(): Promise<Dump> {
  return api().exportDump()
}

/** Validates the backup first; throws BackupFormatError without writing anything if invalid. */
export async function importDump(data: unknown): Promise<void> {
  return api().importDump(parseDump(data))
}
