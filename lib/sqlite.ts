import type { Reading, Settings, Tank, Dump } from './models'
import { invoke } from '@tauri-apps/api/tauri'

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Tanks
export async function listTanks(): Promise<Tank[]> {
  return (await invoke('sqlite_list_tanks')) as Tank[]
}

export async function createTank(
  name: string,
  reminderCadence: number | null = null,
): Promise<Tank> {
  return (await invoke('sqlite_create_tank', { name, reminderCadence })) as Tank
}

export async function renameTank(id: string, name: string): Promise<void> {
  await invoke('sqlite_rename_tank', { id, name })
}

export async function archiveTank(id: string): Promise<void> {
  await invoke('sqlite_archive_tank', { id })
}

export async function setTankReminderCadence(id: string, days: number | null): Promise<void> {
  await invoke('sqlite_set_tank_reminder_cadence', { id, days })
}

// Readings
export async function addReading(input: Omit<Reading, 'id'> & { id?: string }): Promise<Reading> {
  const reading: Reading = { id: input.id ?? uuid(), ...input }
  const payload = { ...reading, pH: reading.pH }
  // The Rust side expects `p_h` due to rename; pass as-is and let serde rename.
  return (await invoke('sqlite_add_reading', { reading: payload })) as Reading
}

export async function updateReading(reading: Reading): Promise<void> {
  const payload = { ...reading, pH: reading.pH }
  await invoke('sqlite_update_reading', { reading: payload })
}

export async function deleteReading(id: string): Promise<void> {
  await invoke('sqlite_delete_reading', { id })
}

export async function listReadingsByTank(tankId: string): Promise<Reading[]> {
  return (await invoke('sqlite_list_readings_by_tank', { tankId })) as Reading[]
}

export async function listReadingsByTankInRange(
  tankId: string,
  fromISO: string,
  toISO: string,
): Promise<Reading[]> {
  return (await invoke('sqlite_list_readings_by_tank_in_range', {
    tankId,
    fromIso: fromISO,
    toIso: toISO,
  })) as Reading[]
}

export async function findMostRecentReading(tankId: string): Promise<Reading | undefined> {
  const all = await listReadingsByTank(tankId)
  return all.length ? all[all.length - 1] : undefined
}

export async function listReadingsWithinHour(tankId: string, tsISO: string): Promise<Reading[]> {
  const center = new Date(tsISO).getTime()
  const start = new Date(center - 30 * 60 * 1000).toISOString()
  const end = new Date(center + 30 * 60 * 1000).toISOString()
  return listReadingsByTankInRange(tankId, start, end)
}

// Settings
export async function getSettings(): Promise<Settings | undefined> {
  return (await invoke('sqlite_get_settings')) as Settings | undefined
}

export async function setSettings(value: Settings): Promise<void> {
  await invoke('sqlite_set_settings', { value })
}

// Seed/init
export async function ensureSeed(): Promise<Tank> {
  const tanks = await listTanks()
  if (tanks.length > 0) return tanks[0]
  return createTank('My Tank')
}

export async function exportDump(): Promise<Dump> {
  return (await invoke('sqlite_export_dump')) as Dump
}

export async function importDump(dump: Dump): Promise<void> {
  await invoke('sqlite_import_dump', { dump })
}
