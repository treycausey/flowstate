'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RouteLink } from '@/components/plants/ui'
import { useTanks } from '@/components/TankProvider'
import TankFromQuery from '@/components/TankFromQuery'
import { useTankReadings } from '@/lib/useTankReadings'
import type { StockGroup } from '@/lib/models'
import { latestReadingsOf } from '@/lib/plants/health'
import { stockSpecies } from '@/lib/stock/catalog'
import { countText } from '@/lib/stock/format'
import { summarizeStock } from '@/lib/stock/summary'
import type { StockSpecies } from '@/lib/stock/types'
import { useNow } from '@/lib/stock/useNow'
import { useStock } from '@/lib/stock/useStock'
import AddStockModal from './AddStockModal'
import FedBar from './FedBar'
import FlagList from './FlagList'
import GroupDetail from './GroupDetail'
import SpeciesPage from './SpeciesPage'
import StockBasics from './StockBasics'
import StockList from './StockList'
import StockPicker from './StockPicker'
import { StockImagesContext } from './StockThumb'
import VolumeField from './VolumeField'
import { routeHref, useStockRoute, type StockRoute } from './route'

type AddState = { species: StockSpecies | null; then: 'stay' | 'open' } | null

const BASICS_KEY = 'stockBasicsOpen'

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

/** The Stock tab: my stock, learn, a species page and a group page. */
export default function StockClient({ images = [] }: { images?: string[] }) {
  const { activeTank, activeTanks, setActiveTankId, loaded } = useTanks()
  const tankId = activeTank?.id ?? null
  const { groups, events, failed } = useStock(tankId)
  const { readings } = useTankReadings(tankId)
  const { route, go } = useStockRoute()
  // Fresh each render, and re-rendered every minute and on return to the tab, so "fed today" rolls over at midnight
  const now = useNow()
  const [adding, setAdding] = useState<AddState>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [basicsOpen, setBasicsOpen] = useState(readBasicsOpen)
  const imageSet = useMemo(() => new Set(images), [images])

  const latestPH = useMemo(() => latestReadingsOf(readings ?? []).pH?.value ?? null, [readings])
  const summary = useMemo(
    () =>
      groups && events
        ? summarizeStock({
            groups,
            events,
            latestPH,
            volumeL: activeTank?.volumeL ?? null,
            now: new Date(),
          })
        : null,
    [groups, events, latestPH, activeTank?.volumeL],
  )
  const allFlags = useMemo(
    () => (summary ? [...summary.groupFlags, ...summary.tankFlags] : []),
    [summary],
  )
  const hasBetta = !!summary?.active.some((g) => g.speciesId === 'betta')

  // After an add, move focus to the new group's row once the list shows it (the first-add
  // button that opened the dialog is gone by then, so focus would otherwise drop to <body>)
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null)
  const focusedGroupId = useRef<string | null>(null)
  useEffect(() => {
    if (!focusGroupId || focusedGroupId.current === focusGroupId) return
    const href = routeHref({ view: 'group', id: focusGroupId })
    // routeHref URI-encodes the id, so it holds no quote or backslash to escape
    const row = document.querySelector<HTMLElement>(`a.stock-row[href="${href}"]`)
    if (row) {
      row.focus()
      focusedGroupId.current = focusGroupId
    }
  }, [focusGroupId, groups])

  if (!loaded) return null
  if (!activeTank) return <p>No tanks yet.</p>

  const openGroup = (g: StockGroup) => go({ view: 'group', id: g.id })
  const groupHref = (g: StockGroup) => routeHref({ view: 'group', id: g.id })
  const sectionOf = route.view === 'learn' || route.view === 'species' ? 'learn' : 'mine'
  const tab = (view: StockRoute, label: string, current: boolean) => (
    <RouteLink
      href={routeHref(view)}
      onNavigate={() => go(view)}
      className="seg__item"
      aria-current={current ? 'page' : undefined}
    >
      {label}
    </RouteLink>
  )
  const back = (view: StockRoute, label: string) => (
    <RouteLink href={routeHref(view)} onNavigate={() => go(view)} className="back-link">
      {label}
    </RouteLink>
  )

  const body = () => {
    if (failed)
      return (
        <p className="danger" role="alert">
          Couldn&apos;t load stock.
        </p>
      )
    if (!groups || !events || !summary) return null

    if (route.view === 'group') {
      const group = groups.find((g) => g.id === route.id)
      if (!group)
        return (
          <div className="stack">
            <h2 tabIndex={-1} id="stock-heading" className="section-title">
              Group not found
            </h2>
            <p className="muted">
              This group is not in {activeTank.name}. It may have been deleted.
            </p>
            {back({ view: 'mine' }, '← My stock')}
          </div>
        )
      return (
        <>
          {back({ view: 'mine' }, '← My stock')}
          <GroupDetail
            key={group.id}
            group={group}
            events={events}
            flags={allFlags}
            now={now}
            onLeave={() => go({ view: 'mine' })}
          />
        </>
      )
    }

    if (route.view === 'species') {
      const species = stockSpecies(route.id)
      if (!species)
        return (
          <div className="stack">
            <h2 tabIndex={-1} id="stock-heading" className="section-title">
              Animal not found
            </h2>
            {back({ view: 'learn' }, '← Learn')}
          </div>
        )
      return (
        <>
          {back({ view: 'learn' }, '← Learn')}
          <SpeciesPage
            species={species}
            tankName={activeTank.name}
            inTank={summary.active
              .filter((g) => g.speciesId === species.id)
              .reduce((sum, g) => sum + g.count, 0)}
            onAdd={() => setAdding({ species, then: 'open' })}
          />
        </>
      )
    }

    if (route.view === 'learn') {
      return (
        <div className="stack">
          <h2 tabIndex={-1} id="stock-heading" className="visually-hidden">
            Learn about fish, shrimp and snails
          </h2>
          <details
            className="basics-disclosure"
            open={basicsOpen}
            onToggle={(e) => {
              setBasicsOpen(e.currentTarget.open)
              saveBasicsOpen(e.currentTarget.open)
            }}
          >
            <summary>Stocking basics</summary>
            <StockBasics />
          </details>
          <section aria-labelledby="stock-catalog-title">
            <h3 id="stock-catalog-title" className="section-title">
              Catalog
            </h3>
            <StockPicker
              hrefFor={(s) => routeHref({ view: 'species', id: s.id })}
              onSelect={(s) => go({ view: 'species', id: s.id })}
            />
          </section>
        </div>
      )
    }

    return (
      <div className="stack">
        <h2 tabIndex={-1} id="stock-heading" className="visually-hidden">
          My stock
        </h2>
        {groups.length === 0 ? (
          <div className="plants-empty">
            <svg className="plants-empty__art" viewBox="0 0 64 64" aria-hidden="true">
              <g
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 34c8-13 20-16 32-9l12-9v32L38 39C26 46 14 46 6 34Z" />
                <path d="M44 28v.01" />
              </g>
            </svg>
            <h3>Add your fish, shrimp and snails</h3>
            <p>
              Record what lives in {activeTank.name}. The tank shows them, and you get gentle tips
              on group sizes, tankmates and feeding.
            </p>
            <div className="cluster">
              <button
                type="button"
                className="button"
                onClick={() => setAdding({ species: null, then: 'stay' })}
              >
                Add your first animals
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
            <FedBar tankId={activeTank.id} events={events} now={now} />
            <div className="plants-toolbar">
              <p className="plants-summary" role="status">
                {summary.animals === 0 ? (
                  'No animals in the tank now.'
                ) : (
                  <>
                    <strong>{countText(summary.animals, 'animal')}</strong>
                    <span className="muted">
                      {' · '}
                      {countText(summary.active.length, 'group')}
                    </span>
                  </>
                )}
                {added && <span className="visually-hidden">{added}</span>}
              </p>
              <button
                type="button"
                className="button"
                onClick={() => setAdding({ species: null, then: 'stay' })}
              >
                Add stock
              </button>
            </div>
            <section className="stock-tank" aria-label="Tank overview">
              {summary.estimate ? (
                <p className={`stock-level stock-level--${summary.estimate.level}`}>
                  <span className="stock-level__label">Stocking: {summary.estimate.level}</span>{' '}
                  {summary.estimate.text}
                </p>
              ) : activeTank.volumeL ? null : (
                <p className="muted stock-level">
                  Add your tank’s volume for a rough stocking estimate.
                </p>
              )}
              {summary.tankFlags.length > 0 && (
                <details
                  className="stock-tips"
                  open={summary.tankFlags.some((f) => f.level !== 'info')}
                >
                  <summary>Tips for this mix ({summary.tankFlags.length})</summary>
                  <FlagList flags={summary.tankFlags} label="Tank guidance" />
                </details>
              )}
              <details className="stock-volume">
                <summary>
                  {activeTank.volumeL ? `Tank volume: ${activeTank.volumeL} L` : 'Set tank volume'}
                </summary>
                <VolumeField key={activeTank.id} tank={activeTank} />
              </details>
            </section>
            <StockList
              groups={groups}
              events={events}
              flags={summary.groupFlags}
              now={now}
              hrefFor={groupHref}
              onOpen={openGroup}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <StockImagesContext.Provider value={imageSet}>
      <TankFromQuery />
      <h1 className="page-title visually-hidden">Stock</h1>
      <div className="plants-nav">
        <nav className="seg" aria-label="Stock sections">
          {tab({ view: 'mine' }, 'My stock', sectionOf === 'mine')}
          {tab({ view: 'learn' }, 'Learn', sectionOf === 'learn')}
        </nav>
        {activeTanks.length > 1 && (
          <label className="inline plants-tank">
            <span className="visually-hidden">Tank</span>
            <select
              value={activeTank.id}
              onChange={(e) => {
                setActiveTankId(e.target.value)
                // A group page belongs to the old tank: show My stock for the new one
                if (route.view === 'group') go({ view: 'mine' })
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
        <AddStockModal
          tankId={activeTank.id}
          hasBetta={hasBetta}
          initialSpecies={adding.species}
          onClose={() => setAdding(null)}
          onAdded={(group) => {
            const opened = adding.then === 'open'
            setAdding(null)
            setAdded(`Added ${group.count} × ${group.name}.`)
            if (opened) go({ view: 'group', id: group.id })
            else setFocusGroupId(group.id)
          }}
        />
      )}
    </StockImagesContext.Provider>
  )
}
