'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTanks } from '@/components/TankProvider'
import TankFromQuery from '@/components/TankFromQuery'
import { useTankReadings } from '@/lib/useTankReadings'
import type { Plant } from '@/lib/models'
import { getSpecies } from '@/lib/plants/catalog'
import { plantAttentionParts, countText } from '@/lib/plants/format'
import {
  isActivePlant,
  latestCheckByPlant,
  latestReadingsOf,
  tankPlantHealth,
} from '@/lib/plants/health'
import type { PlantSpecies } from '@/lib/plants/types'
import { usePlants } from '@/lib/plants/usePlants'
import AddPlantModal from './AddPlantModal'
import PlantBasics from './PlantBasics'
import PlantDetail from './PlantDetail'
import PlantList from './PlantList'
import { PlantImagesContext } from './PlantThumb'
import SpeciesPage from './SpeciesPage'
import SpeciesPicker from './SpeciesPicker'
import { RouteLink } from './ui'
import { routeHref, usePlantsRoute, type PlantsRoute } from './route'

const BASICS_KEY = 'plantBasicsOpen'

/** Open by default; a reader who collapses the basics keeps them collapsed on this device. */
function readBasicsOpen() {
  try {
    return localStorage.getItem(BASICS_KEY) !== 'closed'
  } catch {
    return true
  }
}

function saveBasicsOpen(open: boolean) {
  try {
    localStorage.setItem(BASICS_KEY, open ? 'open' : 'closed')
  } catch {
    // ignore: storage disabled; the choice lasts for this visit only
  }
}

type AddState = { species: PlantSpecies | null; then: 'stay' | 'open' } | null

/** The Plants tab: my plants, learn, a species page and a plant page. */
export default function PlantsClient({ images = [] }: { images?: string[] }) {
  const { activeTank, activeTanks, setActiveTankId, loaded } = useTanks()
  const tankId = activeTank?.id ?? null
  const { plants, checks, failed } = usePlants(tankId)
  const { readings } = useTankReadings(tankId)
  const { route, go } = usePlantsRoute()
  // Fixed at mount so ages don't drift between renders
  const [now] = useState(() => new Date())
  const [adding, setAdding] = useState<AddState>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [basicsOpen, setBasicsOpen] = useState(readBasicsOpen)
  const imageSet = useMemo(() => new Set(images), [images])

  const latestChecks = useMemo(() => latestCheckByPlant(checks ?? []), [checks])
  const health = useMemo(
    () => tankPlantHealth(plants ?? [], latestChecks, now),
    [plants, latestChecks, now],
  )
  const latestReadings = useMemo(() => latestReadingsOf(readings ?? []), [readings])
  // After an add, move focus to the new plant's row once the list shows it (the first-add
  // button that opened the dialog is gone by then, so focus would otherwise drop to <body>)
  const [focusPlantId, setFocusPlantId] = useState<string | null>(null)
  const focusedPlantId = useRef<string | null>(null)
  useEffect(() => {
    if (!focusPlantId || focusedPlantId.current === focusPlantId) return
    const href = routeHref({ view: 'plant', id: focusPlantId })
    // routeHref URI-encodes the id, so it holds no quote or backslash to escape
    const row = document.querySelector<HTMLElement>(`a.plant-row[href="${href}"]`)
    if (row) {
      row.focus()
      focusedPlantId.current = focusPlantId
    }
  }, [focusPlantId, plants])

  if (!loaded) return null
  if (!activeTank) return <p>No tanks yet.</p>

  const openPlant = (p: Plant) => go({ view: 'plant', id: p.id })
  const plantHref = (p: Plant) => routeHref({ view: 'plant', id: p.id })
  const sectionOf = route.view === 'learn' || route.view === 'species' ? 'learn' : 'mine'
  const tab = (view: PlantsRoute, label: string, current: boolean) => (
    <RouteLink
      href={routeHref(view)}
      onNavigate={() => go(view)}
      className="seg__item"
      aria-current={current ? 'page' : undefined}
    >
      {label}
    </RouteLink>
  )

  const body = () => {
    if (failed)
      return (
        <p className="danger" role="alert">
          Couldn&apos;t load plants.
        </p>
      )
    if (!plants || !checks) return null

    if (route.view === 'plant') {
      const plant = plants.find((p) => p.id === route.id)
      if (!plant)
        return (
          <div className="stack">
            <h2 tabIndex={-1} id="plants-heading" className="section-title">
              Plant not found
            </h2>
            <p className="muted">
              This plant is not in {activeTank.name}. It may have been deleted.
            </p>
            <RouteLink
              href={routeHref({ view: 'mine' })}
              onNavigate={() => go({ view: 'mine' })}
              className="back-link"
            >
              ← My plants
            </RouteLink>
          </div>
        )
      return (
        <>
          <RouteLink
            href={routeHref({ view: 'mine' })}
            onNavigate={() => go({ view: 'mine' })}
            className="back-link"
          >
            ← My plants
          </RouteLink>
          <PlantDetail
            key={plant.id}
            plant={plant}
            checks={checks.filter((c) => c.plantId === plant.id)}
            latestReadings={latestReadings}
            now={now}
            onLeave={() => go({ view: 'mine' })}
          />
        </>
      )
    }

    if (route.view === 'species') {
      const species = getSpecies(route.id)
      if (!species)
        return (
          <div className="stack">
            <h2 tabIndex={-1} id="plants-heading" className="section-title">
              Plant not found
            </h2>
            <RouteLink
              href={routeHref({ view: 'learn' })}
              onNavigate={() => go({ view: 'learn' })}
              className="back-link"
            >
              ← Learn
            </RouteLink>
          </div>
        )
      return (
        <>
          <RouteLink
            href={routeHref({ view: 'learn' })}
            onNavigate={() => go({ view: 'learn' })}
            className="back-link"
          >
            ← Learn
          </RouteLink>
          <SpeciesPage
            species={species}
            tankName={activeTank.name}
            inTank={plants.filter((p) => isActivePlant(p) && p.speciesId === species.id).length}
            onAdd={() => setAdding({ species, then: 'open' })}
          />
        </>
      )
    }

    if (route.view === 'learn') {
      return (
        <div className="stack">
          <h2 tabIndex={-1} id="plants-heading" className="visually-hidden">
            Learn about plants
          </h2>
          <details
            className="basics-disclosure"
            open={basicsOpen}
            onToggle={(e) => {
              setBasicsOpen(e.currentTarget.open)
              saveBasicsOpen(e.currentTarget.open)
            }}
          >
            <summary>Plant basics</summary>
            <PlantBasics />
          </details>
          <section aria-labelledby="catalog-title">
            <h3 id="catalog-title" className="section-title">
              Plant catalog
            </h3>
            <SpeciesPicker
              hrefFor={(s) => routeHref({ view: 'species', id: s.id })}
              onSelect={(s) => go({ view: 'species', id: s.id })}
            />
          </section>
        </div>
      )
    }

    const activeCount = plants.filter(isActivePlant).length
    const attention = plantAttentionParts(health)
    return (
      <div className="stack">
        <h2 tabIndex={-1} id="plants-heading" className="visually-hidden">
          My plants
        </h2>
        {plants.length === 0 ? (
          <div className="plants-empty">
            <svg className="plants-empty__art" viewBox="0 0 64 64" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M32 58V30M32 40c-9 0-15-5-16-15 9 0 15 5 16 15ZM32 34c8 0 14-4 15-13-8 0-14 4-15 13ZM32 50c-6 0-11-3-12-9 6 0 11 3 12 9ZM32 50c6 0 10-3 11-8-6 0-10 3-11 8Z" />
              </g>
            </svg>
            <h3>Nothing planted yet</h3>
            <p>
              Add the plants in {activeTank.name} to keep a health history and get gentle
              suggestions when something looks off.
            </p>
            <div className="cluster">
              <button
                type="button"
                className="button"
                onClick={() => setAdding({ species: null, then: 'stay' })}
              >
                Add your first plant
              </button>
              <RouteLink
                href={routeHref({ view: 'learn' })}
                onNavigate={() => go({ view: 'learn' })}
                className="button button--ghost"
              >
                Browse catalog
              </RouteLink>
            </div>
          </div>
        ) : (
          <>
            <div className="plants-toolbar">
              <p className="plants-summary" role="status">
                {activeCount === 0 ? (
                  'No plants in the tank now.'
                ) : (
                  <>
                    <strong>{countText(activeCount, 'plant')}</strong>
                    {attention.length > 0 ? (
                      <>
                        {' · '}
                        <span className="plants-summary__attention">{attention.join(' · ')}</span>
                      </>
                    ) : (
                      <span className="muted"> · all doing well</span>
                    )}
                  </>
                )}
                {added && <span className="visually-hidden">{added}</span>}
              </p>
              <button
                type="button"
                className="button"
                onClick={() => setAdding({ species: null, then: 'stay' })}
              >
                Add plant
              </button>
            </div>
            <PlantList
              plants={plants}
              checks={checks}
              now={now}
              hrefFor={plantHref}
              onOpen={openPlant}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <PlantImagesContext.Provider value={imageSet}>
      <TankFromQuery />
      <h1 className="page-title visually-hidden">Plants</h1>
      <div className="plants-nav">
        <nav className="seg" aria-label="Plants sections">
          {tab({ view: 'mine' }, 'My plants', sectionOf === 'mine')}
          {tab({ view: 'learn' }, 'Learn', sectionOf === 'learn')}
        </nav>
        {activeTanks.length > 1 && (
          <label className="inline plants-tank">
            <span className="visually-hidden">Tank</span>
            <select
              value={activeTank.id}
              onChange={(e) => {
                setActiveTankId(e.target.value)
                // A plant page belongs to the old tank: show My plants for the new one
                if (route.view === 'plant') go({ view: 'mine' })
              }}
              aria-label="Tank"
            >
              {activeTanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {body()}
      {adding && (
        <AddPlantModal
          tankId={activeTank.id}
          initialSpecies={adding.species}
          onClose={() => setAdding(null)}
          onAdded={(plant) => {
            const opened = adding.then === 'open'
            setAdding(null)
            setAdded(`Added ${plant.name}.`)
            if (opened) go({ view: 'plant', id: plant.id })
            else setFocusPlantId(plant.id)
          }}
        />
      )}
    </PlantImagesContext.Provider>
  )
}
