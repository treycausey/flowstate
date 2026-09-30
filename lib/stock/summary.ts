import type { StockEvent, StockGroup } from '@/lib/models'
import { fedToday } from './feeding'
import {
  activeGroups,
  animalCount,
  groupFlags,
  stockingEstimate,
  tankFlags,
  type StockFlag,
  type StockingEstimate,
} from './guidance'

export type StockSummary = {
  /** Groups in the tank now. */
  active: StockGroup[]
  animals: number
  fedToday: boolean
  /** Flags about single groups. */
  groupFlags: StockFlag[]
  /** Flags about the whole tank (shared temperature and pH ranges). */
  tankFlags: StockFlag[]
  estimate: StockingEstimate | null
}

/** Everything the page, the Log status line and the report need, from one set of inputs. */
export function summarizeStock(input: {
  groups: readonly StockGroup[]
  events: readonly StockEvent[]
  latestPH?: number | null
  volumeL?: number | null
  now: Date
}): StockSummary {
  const ctx = { groups: input.groups, latestPH: input.latestPH, volumeL: input.volumeL }
  return {
    active: activeGroups(input.groups),
    animals: animalCount(input.groups),
    fedToday: fedToday(input.events, input.now),
    groupFlags: groupFlags(ctx),
    tankFlags: tankFlags(ctx),
    estimate: stockingEstimate(input.groups, input.volumeL),
  }
}

/** Flags worth showing as attention: anything above a tip. */
export function attentionCount(flags: readonly StockFlag[]): number {
  return flags.filter((f) => f.level !== 'info').length
}
