'use client'

import { countText } from '@/lib/stock/format'
import { ZONE_LABEL, type StockSpecies } from '@/lib/stock/types'
import StockCare from './StockCare'
import StockThumb from './StockThumb'

type Props = {
  species: StockSpecies
  tankName: string
  /** Animals of this species already in the tank. */
  inTank: number
  onAdd: () => void
}

/** One catalog species: hero, "Add to this tank" and the care card. */
export default function SpeciesPage({ species, tankName, inTank, onAdd }: Props) {
  return (
    <div className="stack plant-detail">
      <div className="plant-hero">
        <StockThumb speciesId={species.id} kind={species.kind} size="lg" />
        <div className="plant-hero__text">
          <h2 tabIndex={-1} id="stock-heading" className="plant-hero__name">
            {species.name}
          </h2>
          <p className="plant-hero__sci">{species.scientific}</p>
          <p className="plant-hero__meta muted">
            {ZONE_LABEL[species.zone]} · ~{species.sizeCm} cm
          </p>
        </div>
      </div>
      <div className="cluster plant-detail__actions">
        <button type="button" className="button" onClick={onAdd}>
          Add to this tank
        </button>
        {inTank > 0 && (
          <span className="muted">
            {countText(inTank, 'animal')} of this species already in {tankName}.
          </span>
        )}
      </div>
      <StockCare species={species} />
    </div>
  )
}
