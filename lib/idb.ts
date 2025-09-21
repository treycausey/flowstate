import type { Reading, Settings, Tank } from './models'
import * as idb from './idb-browser'
import * as sqlite from './sqlite'
import { isTauri } from './tauri'

const api = isTauri() ? sqlite : idb

export const getAll = idb.getAll // browser-only helper (unused in sqlite)

// Tanks
export function listTanks(): Promise<Tank[]> {
  return api.listTanks()
}

export function createTank(name: string, reminderCadence: number | null = null): Promise<Tank> {
  return api.createTank(name, reminderCadence)
}

export function renameTank(id: string, name: string): Promise<void> {
  return api.renameTank(id, name)
}

export function archiveTank(id: string): Promise<void> {
  return api.archiveTank(id)
}

export function setTankReminderCadence(id: string, days: number | null): Promise<void> {
  return api.setTankReminderCadence(id, days)
}

// Readings
export function addReading(input: Omit<Reading, 'id'> & { id?: string }): Promise<Reading> {
  return api.addReading(input)
}

export function updateReading(reading: Reading): Promise<void> {
  return api.updateReading(reading)
}

export function deleteReading(id: string): Promise<void> {
  return api.deleteReading(id)
}

export function listReadingsByTank(tankId: string): Promise<Reading[]> {
  return api.listReadingsByTank(tankId)
}

export function listReadingsByTankInRange(
  tankId: string,
  fromISO: string,
  toISO: string,
): Promise<Reading[]> {
  return api.listReadingsByTankInRange(tankId, fromISO, toISO)
}

export function findMostRecentReading(tankId: string): Promise<Reading | undefined> {
  return api.findMostRecentReading(tankId)
}

export function listReadingsWithinHour(tankId: string, tsISO: string): Promise<Reading[]> {
  return api.listReadingsWithinHour(tankId, tsISO)
}

// Settings
export function getSettings(): Promise<Settings | undefined> {
  return api.getSettings()
}

export function setSettings(value: Settings): Promise<void> {
  return api.setSettings(value)
}

// Seed/init
export function ensureSeed(): Promise<Tank> {
  return api.ensureSeed()
}

export function exportDump() {
  return api.exportDump()
}

export function importDump(dump: any) {
  return api.importDump(dump)
}
