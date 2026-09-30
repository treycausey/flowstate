import type { StockEvent, StockGroup, Tank } from '@/lib/models'
import { stockSpecies } from '@/lib/stock/catalog'
import { HEALTH_TEXT, HEALTH_TONE, lastFedAt, latestHealthByGroup } from '@/lib/stock/feeding'
import { volumeText } from '@/lib/stock/format'
import { flagsForGroup } from '@/lib/stock/guidance'
import { summarizeStock } from '@/lib/stock/summary'
import { ZONE_LABEL } from '@/lib/stock/types'
import { formatLocal } from '@/lib/time'

const dateOnly = { dateStyle: 'medium' } as const
const dateTime = { dateStyle: 'medium', timeStyle: 'short' } as const

/** Printable list of the tank's stock: groups, counts, last fed and guidance. Nothing when empty. */
export default function StockReportSection({
  tank,
  groups,
  events,
  latestPH,
}: {
  tank: Tank
  groups: StockGroup[]
  events: StockEvent[]
  latestPH?: number | null
}) {
  const summary = summarizeStock({
    groups,
    events,
    latestPH,
    volumeL: tank.volumeL ?? null,
    now: new Date(),
  })
  if (summary.active.length === 0) return null
  const health = latestHealthByGroup(events)
  const lastFed = lastFedAt(events)
  const notes = [...summary.groupFlags, ...summary.tankFlags].filter((f) => f.level !== 'info')
  return (
    <section aria-labelledby="stock-report-heading">
      <h2 id="stock-report-heading" className="section-title">
        Stock
      </h2>
      <p className="stock-report__line">
        <strong>{summary.animals}</strong> {summary.animals === 1 ? 'animal' : 'animals'} in{' '}
        {summary.active.length} {summary.active.length === 1 ? 'group' : 'groups'}
        {' · '}
        {lastFed ? `last fed ${formatLocal(lastFed, undefined, dateTime)}` : 'no feedings logged'}
        {tank.volumeL ? ` · ${volumeText(tank.volumeL)}` : ''}
        {summary.estimate ? ` · stocking looks ${summary.estimate.level} (a rough guide)` : ''}
      </p>
      <div className="table-scroll">
        <table className="plants-report">
          <thead>
            <tr>
              <th scope="col" className="left">
                Animals
              </th>
              <th scope="col" className="left">
                Count
              </th>
              <th scope="col" className="left">
                Zone
              </th>
              <th scope="col" className="left">
                Latest health
              </th>
              <th scope="col" className="left">
                Added
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.active.map((g) => {
              const species = stockSpecies(g.speciesId)
              const h = health.get(g.id)
              const mine = flagsForGroup(notes, g.id)
              return (
                <tr key={g.id}>
                  <th scope="row" className="left">
                    {g.name}
                    {species && species.scientific !== g.name && (
                      <span className="plants-report__sci">{species.scientific}</span>
                    )}
                    {mine.length > 0 && (
                      <span className="plants-report__sci">
                        {mine.map((f) => f.text).join(' ')}
                      </span>
                    )}
                  </th>
                  <td className="left">{g.count}</td>
                  <td className="left">{species ? ZONE_LABEL[species.zone] : '—'}</td>
                  <td className="left">
                    {h?.health ? (
                      <span
                        className={`plants-report__health plants-report__health--${HEALTH_TONE[h.health]}`}
                      >
                        {HEALTH_TEXT[h.health]}
                      </span>
                    ) : (
                      <span className="muted">Not noted</span>
                    )}
                  </td>
                  <td className="left nowrap">
                    {formatLocal(new Date(g.addedAt), undefined, dateOnly)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {summary.tankFlags.filter((f) => f.level !== 'info').length > 0 && (
        <ul className="stock-report__notes">
          {summary.tankFlags
            .filter((f) => f.level !== 'info')
            .map((f) => (
              <li key={f.id}>{f.text}</li>
            ))}
        </ul>
      )}
    </section>
  )
}
