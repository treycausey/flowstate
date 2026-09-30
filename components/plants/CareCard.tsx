import { formatPh, formatTemp } from '@/lib/plants/catalog'
import { SYMPTOMS } from '@/lib/plants/health'
import type { PlantSpecies } from '@/lib/plants/types'
import { Fact } from './ui'

const LIGHT_TEXT = { low: 'Low', medium: 'Medium', high: 'High' } as const
const CO2_TEXT = { 'not needed': 'Not needed', helps: 'Helps', recommended: 'Recommended' } as const
const FEEDING_TEXT = {
  root: 'roots',
  'water column': 'the water',
  both: 'roots and water',
} as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Scannable care summary for one species: fact chips, then the short care sentences. */
export default function CareCard({ species }: { species: PlantSpecies }) {
  return (
    <div className="care-card">
      <ul className="facts" aria-label="Quick facts">
        <Fact label="Difficulty" value={cap(species.difficulty)} />
        <Fact label="Light" value={LIGHT_TEXT[species.light]} />
        <Fact label="CO₂" value={CO2_TEXT[species.co2]} />
        <Fact label="Growth" value={cap(species.growth)} />
        <Fact label="Feeds through" value={FEEDING_TEXT[species.feeding]} />
        <Fact label="pH" value={formatPh(species.ph)} />
        <Fact label="Temperature" value={formatTemp(species.tempC)} />
        {species.maxHeightCm !== undefined && (
          <Fact label="Height" value={`up to ~${species.maxHeightCm} cm`} />
        )}
      </ul>
      <dl className="care-notes">
        <div>
          <dt>Planting</dt>
          <dd>{species.planting}</dd>
        </div>
        <div>
          <dt>Care</dt>
          <dd>{species.care}</dd>
        </div>
        <div>
          <dt>In a betta tank</dt>
          <dd>{species.bettaNote}</dd>
        </div>
        <div>
          <dt>Propagation</dt>
          <dd>{species.propagation}</dd>
        </div>
        <div>
          <dt>Common problems</dt>
          <dd>
            <ul className="facts facts--quiet" aria-label="Common problems">
              {species.commonProblems.map((id) => (
                <li key={id} className="fact">
                  {SYMPTOMS[id].label}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <p className="care-foot muted">General guidance, not a dosing guide.</p>
    </div>
  )
}
