import { Fact } from '@/components/plants/ui'
import { phRangeText, sizeText, tempRangeText } from '@/lib/stock/format'
import { KIND_LABEL, ZONE_LABEL, type StockSpecies } from '@/lib/stock/types'
import { BettaBadge } from './StockPicker'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Scannable care summary for one species: fact chips, then the short care sentences. */
export default function StockCare({ species }: { species: StockSpecies }) {
  return (
    <div className="care-card">
      <ul className="facts" aria-label="Quick facts">
        <Fact label="Kind" value={KIND_LABEL[species.kind].replace(/s$/, '')} />
        <Fact label="Lives in" value={ZONE_LABEL[species.zone].toLowerCase()} />
        <Fact label="Adult size" value={`~${sizeText(species.sizeCm)}`} />
        <Fact label="Temperature" value={tempRangeText(species.tempC)} />
        <Fact label="pH" value={phRangeText(species.ph)} />
        <Fact
          label="Group"
          value={species.minGroup > 1 ? `${species.minGroup} or more` : 'Any number'}
        />
        <Fact label="Temperament" value={cap(species.temperament)} />
      </ul>
      <dl className="care-notes">
        <div>
          <dt>Care</dt>
          <dd>{species.care}</dd>
        </div>
        <div>
          <dt>Diet</dt>
          <dd>{species.diet}</dd>
        </div>
        <div>
          <dt>{species.id === 'betta' ? 'Tankmates' : 'With a betta'}</dt>
          <dd>
            <BettaBadge species={species} /> {species.bettaReason}
          </dd>
        </div>
        <div>
          <dt>Good to know</dt>
          <dd>{species.notes}</dd>
        </div>
      </dl>
      <p className="care-foot muted">
        Ranges are comfortable figures for healthy, captive-bred animals. General guidance, not a
        rulebook.
      </p>
    </div>
  )
}
