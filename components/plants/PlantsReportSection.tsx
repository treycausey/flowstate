import type { Plant, PlantCheck } from '@/lib/models'
import { getSpecies } from '@/lib/plants/catalog'
import { HEALTH_LABEL, HEALTH_TONE, isActivePlant, latestCheckByPlant } from '@/lib/plants/health'
import { PLACEMENT_LABEL } from '@/lib/plants/types'
import { formatLocal } from '@/lib/time'

const dateOnly = { dateStyle: 'medium' } as const

/** Printable list of the tank's plants with their latest health. Nothing when there are none. */
export default function PlantsReportSection({
  plants,
  checks,
}: {
  plants: Plant[]
  checks: PlantCheck[]
}) {
  const active = plants.filter(isActivePlant)
  if (active.length === 0) return null
  const latest = latestCheckByPlant(checks)
  return (
    <section aria-labelledby="plants-report-heading">
      <h2 id="plants-report-heading" className="section-title">
        Plants
      </h2>
      <div className="table-scroll">
        <table className="plants-report">
          <thead>
            <tr>
              <th scope="col" className="left">
                Plant
              </th>
              <th scope="col" className="left">
                Placement
              </th>
              <th scope="col" className="left">
                Latest health
              </th>
              <th scope="col" className="left">
                Checked
              </th>
            </tr>
          </thead>
          <tbody>
            {active.map((p) => {
              const check = latest.get(p.id)
              const species = getSpecies(p.speciesId)
              return (
                <tr key={p.id}>
                  <th scope="row" className="left">
                    {p.name}
                    {species && species.scientific !== p.name && (
                      <span className="plants-report__sci">{species.scientific}</span>
                    )}
                  </th>
                  <td className="left">{PLACEMENT_LABEL[p.placement]}</td>
                  <td className="left">
                    {check ? (
                      <span
                        className={`plants-report__health plants-report__health--${HEALTH_TONE[check.health]}`}
                      >
                        {HEALTH_LABEL[check.health]}
                      </span>
                    ) : (
                      <span className="muted">Not checked</span>
                    )}
                  </td>
                  <td className="left nowrap">
                    {check ? formatLocal(new Date(check.ts), undefined, dateOnly) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
