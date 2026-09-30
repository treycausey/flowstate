import type { StockFlag } from '@/lib/stock/guidance'

const MARK: Record<StockFlag['level'], string> = {
  info: 'Tip',
  caution: 'Caution',
  danger: 'Poor match',
}

/**
 * Guidance flags as a calm list. The word carries the level, colour only backs it up.
 * Each item names its level first so screen readers and print get the same cue.
 */
export default function FlagList({
  flags,
  label = 'Guidance',
  compact = false,
}: {
  flags: readonly StockFlag[]
  label?: string
  compact?: boolean
}) {
  if (flags.length === 0) return null
  return (
    <ul className={`stock-flags${compact ? ' stock-flags--compact' : ''}`} aria-label={label}>
      {flags.map((f) => (
        <li key={f.id} className={`stock-flag stock-flag--${f.level}`}>
          <span className="stock-flag__mark">{MARK[f.level]}</span> {f.text}
        </li>
      ))}
    </ul>
  )
}
