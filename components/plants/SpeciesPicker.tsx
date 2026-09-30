'use client'

import { useId, useState } from 'react'
import { filterSpecies } from '@/lib/plants/catalog'
import { PLACEMENTS, PLACEMENT_LABEL, type Placement, type PlantSpecies } from '@/lib/plants/types'
import PlantThumb from './PlantThumb'
import { RouteLink, ToggleChip } from './ui'

const LIGHT_SHORT = { low: 'Low light', medium: 'Medium light', high: 'High light' } as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Props = {
  /** Called when a species is chosen (a click on its row). */
  onSelect: (species: PlantSpecies) => void
  /** When set, rows are real links to this href and `onSelect` handles plain clicks. */
  hrefFor?: (species: PlantSpecies) => string
  /** Extra action shown under the list, e.g. "Custom plant". */
  footer?: React.ReactNode
}

/** Searchable, filterable catalog list. Shared by the Add plant dialog and the Learn tab. */
export default function SpeciesPicker({ onSelect, hrefFor, footer }: Props) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [easyOnly, setEasyOnly] = useState(false)
  const [lowLight, setLowLight] = useState(false)
  const [bettaFriendly, setBettaFriendly] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const results = filterSpecies({ query, easyOnly, lowLight, bettaFriendly, placement })
  const anyFilter = easyOnly || lowLight || bettaFriendly || placement !== null || query !== ''

  return (
    <div className="picker">
      <div className="field">
        <label htmlFor={searchId} className="visually-hidden">
          Search plants
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
      <div className="chips" role="group" aria-label="Filter plants">
        <ToggleChip pressed={easyOnly} onClick={() => setEasyOnly(!easyOnly)}>
          Easy only
        </ToggleChip>
        <ToggleChip pressed={lowLight} onClick={() => setLowLight(!lowLight)}>
          Low light
        </ToggleChip>
        <ToggleChip pressed={bettaFriendly} onClick={() => setBettaFriendly(!bettaFriendly)}>
          Betta-friendly
        </ToggleChip>
      </div>
      <div className="chips" role="group" aria-label="Filter by placement">
        {PLACEMENTS.map((p) => (
          <ToggleChip
            key={p}
            pressed={placement === p}
            onClick={() => setPlacement(placement === p ? null : p)}
          >
            {PLACEMENT_LABEL[p]}
          </ToggleChip>
        ))}
      </div>
      <p className="picker__count muted" role="status">
        {results.length === 0
          ? 'No plants match.'
          : `${results.length} plant${results.length === 1 ? '' : 's'}`}
        {anyFilter && results.length === 0 && (
          <>
            {' '}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setQuery('')
                setEasyOnly(false)
                setLowLight(false)
                setBettaFriendly(false)
                setPlacement(null)
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
              <PlantThumb speciesId={s.id} placement={s.placement} />
              <span className="picker__text">
                <span className="picker__name">{s.name}</span>
                <span className="picker__sci">{s.scientific}</span>
                <span className="picker__meta">
                  {cap(s.difficulty)} · {LIGHT_SHORT[s.light]} · {PLACEMENT_LABEL[s.placement]}
                </span>
              </span>
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
