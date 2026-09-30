'use client'

import { useId, useState, type ReactNode } from 'react'
import { filterStock } from '@/lib/stock/catalog'
import { tempRangeShort } from '@/lib/stock/format'
import {
  KIND_LABEL,
  STOCK_KINDS,
  STOCK_ZONES,
  ZONE_LABEL,
  type StockKind,
  type StockSpecies,
  type StockZone,
} from '@/lib/stock/types'
import { RouteLink, ToggleChip } from '@/components/plants/ui'
import StockThumb from './StockThumb'

type Props = {
  /** Called when a species is chosen (a click on its row). */
  onSelect: (species: StockSpecies) => void
  /** When set, rows are real links to this href and `onSelect` handles plain clicks. */
  hrefFor?: (species: StockSpecies) => string
  /** Extra action shown under the list, e.g. "Custom species". */
  footer?: ReactNode
}

export function BettaBadge({ species }: { species: StockSpecies }) {
  if (species.id === 'betta') return null
  const text = { good: 'Betta-safe', caution: 'Betta: caution', avoid: 'Betta: avoid' }[
    species.bettaCompat
  ]
  return <span className={`stock-compat stock-compat--${species.bettaCompat}`}>{text}</span>
}

/** Searchable, filterable catalog list. Shared by the Add stock dialog and the Learn tab. */
export default function StockPicker({ onSelect, hrefFor, footer }: Props) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [bettaSafe, setBettaSafe] = useState(false)
  const [kind, setKind] = useState<StockKind | null>(null)
  const [zone, setZone] = useState<StockZone | null>(null)
  const results = filterStock({ query, bettaSafe, kind, zone })
  const anyFilter = bettaSafe || kind !== null || zone !== null || query !== ''

  return (
    <div className="picker">
      <div className="field">
        <label htmlFor={searchId} className="visually-hidden">
          Search animals
        </label>
        <input
          id={searchId}
          type="search"
          className="picker__search"
          placeholder="Search by name"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="chips" role="group" aria-label="Filter animals">
        <ToggleChip pressed={bettaSafe} onClick={() => setBettaSafe(!bettaSafe)}>
          Betta-safe
        </ToggleChip>
        {STOCK_KINDS.map((k) => (
          <ToggleChip key={k} pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>
            {KIND_LABEL[k]}
          </ToggleChip>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Filter by zone">
        {STOCK_ZONES.map((z) => (
          <ToggleChip key={z} pressed={zone === z} onClick={() => setZone(zone === z ? null : z)}>
            {ZONE_LABEL[z]}
          </ToggleChip>
        ))}
      </div>
      <p className="picker__count muted" role="status">
        {results.length === 0 ? 'No animals match.' : `${results.length} species`}
        {anyFilter && results.length === 0 && (
          <>
            {' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setQuery('')
                setBettaSafe(false)
                setKind(null)
                setZone(null)
              }}
            >
              Clear filters
            </button>
          </>
        )}
      </p>
      <ul className="picker__list">
        {results.map((s) => {
          const body = (
            <>
              <StockThumb speciesId={s.id} kind={s.kind} />
              <span className="picker__text">
                <span className="picker__name">{s.name}</span>
                <span className="picker__sci">{s.scientific}</span>
                <span className="picker__meta">
                  {ZONE_LABEL[s.zone]} · {s.sizeCm} cm · {tempRangeShort(s.tempC)}
                </span>
              </span>
              <BettaBadge species={s} />
            </>
          )
          return (
            <li key={s.id}>
              {hrefFor ? (
                <RouteLink href={hrefFor(s)} onNavigate={() => onSelect(s)} className="picker__row">
                  {body}
                </RouteLink>
              ) : (
                <button type="button" className="picker__row" onClick={() => onSelect(s)}>
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {footer}
    </div>
  )
}
