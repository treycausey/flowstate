'use client'

import { countText } from '@/lib/plants/format'
import type { PlantSpecies } from '@/lib/plants/types'
import { PLACEMENT_LABEL } from '@/lib/plants/types'
import CareCard from './CareCard'
import { SpeciesPhoto } from './PlantThumb'

type Props = {
  species: PlantSpecies
  tankName: string
  /** Active plants of this species already in the tank. */
  inTank: number
  onAdd: () => void
}

/** One catalog species: hero, "Add to this tank" and the care card. */
export default function SpeciesPage({ species, tankName, inTank, onAdd }: Props) {
  return (
    <div className="stack plant-detail">
      <div className="plant-hero plant-hero--species">
        <SpeciesPhoto speciesId={species.id} name={species.name} placement={species.placement} />
        <div className="plant-hero__text">
          <h2 tabIndex={-1} id="plants-heading" className="plant-hero__name">
            {species.name}
          </h2>
          <p className="plant-hero__sci">{species.scientific}</p>
          <p className="plant-hero__meta muted">
            {PLACEMENT_LABEL[species.placement]} plant
            {species.bettaFriendly ? ' · suits a betta tank' : ''}
          </p>
        </div>
      </div>
      <div className="cluster plant-detail__actions">
        <button type="button" className="button" onClick={onAdd}>
          Add to this tank
        </button>
        {inTank > 0 && (
          <span className="muted">
            {countText(inTank, 'plant')} of this species already in {tankName}.
          </span>
        )}
      </div>
      <CareCard species={species} />
    </div>
  )
}
