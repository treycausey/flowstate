'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TankScene, {
  type PanelRect,
  type ScriptedEvent,
  type TankSceneControls,
} from '@/components/tank/TankScene'
import {
  getEnvironment,
  type Environment,
  type Hemisphere,
  type Holiday,
  type Season,
} from '@/lib/tank/environment'
import { dropPellet } from '@/lib/tank/events'
import { SPECIES } from '@/lib/tank/species'
import {
  formatStockParam,
  parseStockParam,
  stockEntry,
  STOCK_PRESETS,
  type StockEntry,
} from '@/lib/tank/stock'
import type { Mood, WaterState } from '@/lib/tank/waterState'

type PhaseChoice = 'auto' | 'dawn' | 'day' | 'dusk' | 'night'

type Controls = {
  phase: PhaseChoice
  hour: number | null
  season: Season | 'auto'
  hemisphere: Hemisphere
  holiday: Holiday | 'auto'
  moon: number | null
  haze: number
  algae: number
  dust: number
  sparkle: number
  mood: Mood
  nest: boolean
  freeze: boolean
  t: number
  reduced: boolean
  panel: boolean
  bare: boolean
  script: ScriptedEvent[]
  seed: number
  debug: string
  stock: StockEntry[]
}

const DEFAULTS: Controls = {
  phase: 'auto',
  hour: null,
  season: 'auto',
  hemisphere: 'north',
  holiday: 'auto',
  moon: null,
  haze: 0,
  algae: 0,
  dust: 0,
  sparkle: 0.6,
  mood: 'healthy',
  nest: false,
  freeze: false,
  t: 9,
  reduced: false,
  panel: false,
  bare: false,
  script: [],
  seed: 1,
  debug: '',
  stock: [],
}

const PHASE_HOUR: Record<Exclude<PhaseChoice, 'auto'>, number> = {
  dawn: 6.6,
  day: 13,
  dusk: 19.2,
  night: 23,
}
const PHASES: PhaseChoice[] = ['auto', 'dawn', 'day', 'dusk', 'night']
const SEASONS: Array<Season | 'auto'> = ['auto', 'spring', 'summer', 'autumn', 'winter']
const HOLIDAYS: Array<Holiday | 'auto'> = ['auto', null, 'halloween', 'winter', 'newyear']
const MOODS: Mood[] = ['thriving', 'healthy', 'dull', 'stressed']

function num(v: string | null, fallback: number | null) {
  if (v === null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function oneOf<T extends string>(v: string | null, options: readonly T[], fallback: T): T {
  return v !== null && (options as readonly string[]).includes(v) ? (v as T) : fallback
}

/** `script=flare@8;pellet@2:0.5:0.1;focus@3:0.4:0.5;inspect@1` (seconds, then optional x:y). */
function parseScript(raw: string | null): ScriptedEvent[] {
  if (!raw) return []
  const kinds = ['flare', 'pellet', 'inspect', 'focus', 'blur', 'look'] as const
  return raw.split(';').flatMap((part) => {
    const [type, rest] = part.split('@')
    if (!(kinds as readonly string[]).includes(type) || !rest) return []
    const [t, x, y] = rest.split(':').map(Number)
    if (!Number.isFinite(t)) return []
    return [
      {
        t,
        type: type as ScriptedEvent['type'],
        x: Number.isFinite(x) ? x : undefined,
        y: Number.isFinite(y) ? y : undefined,
      },
    ]
  })
}

function parseQuery(search: string): Controls {
  const q = new URLSearchParams(search)
  const mood = oneOf(q.get('mood'), MOODS, DEFAULTS.mood)
  const hazeParam = num(q.get('haze'), null)
  return {
    phase: oneOf(q.get('phase'), PHASES, 'auto'),
    hour: num(q.get('hour'), null),
    season: oneOf(q.get('season'), SEASONS, 'auto'),
    hemisphere: oneOf(q.get('hemisphere'), ['north', 'south'] as const, 'north'),
    holiday:
      q.get('holiday') === 'none'
        ? null
        : oneOf(q.get('holiday'), ['auto', 'halloween', 'winter', 'newyear'] as const, 'auto'),
    moon: num(q.get('moon'), null),
    haze: hazeParam ?? (mood === 'stressed' ? 0.55 : DEFAULTS.haze),
    algae: num(q.get('algae'), DEFAULTS.algae) ?? 0,
    dust: num(q.get('dust'), DEFAULTS.dust) ?? 0,
    sparkle: num(q.get('sparkle'), mood === 'thriving' ? 1 : DEFAULTS.sparkle) ?? 0.6,
    mood,
    nest: q.get('nest') === '1',
    freeze: q.get('freeze') === '1',
    t: num(q.get('t'), DEFAULTS.t) ?? 9,
    reduced: q.get('reduced') === '1',
    panel: q.get('panel') === '1',
    bare: q.get('bare') === '1',
    script: parseScript(q.get('script')),
    seed: num(q.get('seed'), 1) ?? 1,
    debug: q.get('debug') ?? '',
    stock: parseStockParam(q.get('stock')),
  }
}

function buildEnvironment(c: Controls): Environment | undefined {
  const auto =
    c.phase === 'auto' &&
    c.hour === null &&
    c.season === 'auto' &&
    c.holiday === 'auto' &&
    c.moon === null
  if (auto && c.hemisphere === 'north') return undefined
  const now = new Date()
  const hour =
    c.hour ?? (c.phase === 'auto' ? now.getHours() + now.getMinutes() / 60 : PHASE_HOUR[c.phase])
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Math.floor(hour),
    Math.round((hour % 1) * 60),
  )
  const env = getEnvironment(d, { hemisphere: c.hemisphere })
  return {
    ...env,
    season: c.season === 'auto' ? env.season : c.season,
    holiday: c.holiday === 'auto' ? env.holiday : c.holiday,
    moon:
      c.moon === null
        ? env.moon
        : { phase: c.moon, illumination: (1 - Math.cos(2 * Math.PI * c.moon)) / 2 },
  }
}

const drawerStyle: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  zIndex: 50,
  width: 280,
  maxHeight: 'calc(100vh - 24px)',
  overflow: 'auto',
  padding: 12,
  borderRadius: 10,
  background: 'rgba(12, 18, 20, 0.86)',
  color: '#e8efe9',
  font: '12px/1.4 system-ui, sans-serif',
}
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '84px 1fr 34px',
  gap: 6,
  alignItems: 'center',
  margin: '4px 0',
}

export default function TankDevClient() {
  const [c, setC] = useState<Controls | null>(null)
  const [open, setOpen] = useState(true)
  const [stats, setStats] = useState({ fps: 0, frameMs: 0, level: 'full' as 'full' | 'half' })
  const controls = useRef<TankSceneControls | null>(null)
  const [pick, setPick] = useState({ id: 'neon-tetra', count: 8 })

  useEffect(() => {
    const parsed = parseQuery(window.location.search)
    setC(parsed)
    setOpen(!window.location.search.includes('drawer=0'))
  }, [])

  // Hooks for screenshot scripts: step the frozen sim time without reloading, read the fish state.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__tankSetT = (t: number) => setC((prev) => (prev ? { ...prev, freeze: true, t } : prev))
    w.__tankFrame = () => controls.current?.frame() ?? null
    return () => {
      delete w.__tankSetT
      delete w.__tankFrame
    }
  }, [])

  const environment = useMemo(() => (c ? buildEnvironment(c) : undefined), [c])
  const water: WaterState = useMemo(
    () => ({
      haze: c?.haze ?? 0,
      algae: c?.algae ?? 0,
      sparkle: c?.sparkle ?? 0.6,
      dust: c?.dust ?? 0,
      mood: c?.mood ?? 'healthy',
      bubbleNest: c?.nest ?? false,
    }),
    [c],
  )
  const [realPanel, setRealPanel] = useState<PanelRect | null>(null)
  useEffect(() => {
    if (!c || c.bare) return
    const el = document.querySelector('.app-panel')
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRealPanel((prev) =>
        prev &&
        prev.left === r.left &&
        prev.top === r.top &&
        prev.right === r.right &&
        prev.bottom === r.bottom
          ? prev
          : { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      )
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [c])
  const mockPanel: PanelRect | null = useMemo(() => {
    if (!c?.panel || typeof window === 'undefined') return null
    const w = window.innerWidth
    const h = window.innerHeight
    return { left: w * 0.045, top: h * 0.03, right: w * 0.29, bottom: h * 0.95 }
  }, [c?.panel])
  const exclusion = c?.bare ? mockPanel : realPanel

  if (!c) return null
  const set = <K extends keyof Controls>(key: K, value: Controls[K]) => setC({ ...c, [key]: value })
  const slider = (key: 'haze' | 'algae' | 'dust' | 'sparkle', label: string) => (
    <label style={rowStyle}>
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={c[key]}
        onChange={(e) => set(key, Number(e.target.value))}
      />
      <span>{c[key].toFixed(2)}</span>
    </label>
  )
  const select = <T extends string | null>(
    label: string,
    value: T,
    options: readonly T[],
    on: (v: T) => void,
  ) => (
    <label style={{ ...rowStyle, gridTemplateColumns: '84px 1fr' }}>
      <span>{label}</span>
      <select
        value={String(value)}
        onChange={(e) => on((options.find((o) => String(o) === e.target.value) ?? options[0]) as T)}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {o === null ? 'none' : String(o)}
          </option>
        ))}
      </select>
    </label>
  )
  const hourNow = c.hour ?? (c.phase === 'auto' ? new Date().getHours() : PHASE_HOUR[c.phase])

  return (
    <>
      {c.bare && <style>{'.app-panel { display: none !important; }'}</style>}
      <TankScene
        water={water}
        exclusion={exclusion}
        environment={environment}
        hemisphere={c.hemisphere}
        freezeAt={c.freeze ? c.t : null}
        freezeScript={c.script}
        reducedMotion={c.reduced || undefined}
        seed={c.seed}
        stock={c.stock}
        debugAlpha={c.debug === 'alpha'}
        controlsRef={controls}
        onStats={setStats}
      />
      {c.bare &&
        c.panel &&
        exclusion &&
        createPortal(
          <div
            data-tank-ignore
            style={{
              position: 'fixed',
              left: exclusion.left,
              top: exclusion.top,
              width: exclusion.right - exclusion.left,
              height: exclusion.bottom - exclusion.top,
              borderRadius: 14,
              background: 'rgba(240, 236, 226, 0.82)',
            }}
          />,
          document.body,
        )}
      {createPortal(
        !open ? (
          <button
            data-tank-ignore
            type="button"
            onClick={() => setOpen(true)}
            style={{ ...drawerStyle, width: 'auto', padding: '6px 10px' }}
          >
            Tank controls
          </button>
        ) : (
          <aside data-tank-ignore aria-label="Tank controls" style={drawerStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Tank controls</strong>
              <span>
                {stats.fps.toFixed(0)} fps · {stats.frameMs.toFixed(1)} ms
                {stats.level === 'half' ? ' · 30 fps mode' : ''}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Collapse controls">
                Hide
              </button>
            </div>
            {select('Phase', c.phase, PHASES, (v) => setC({ ...c, phase: v, hour: null }))}
            <label style={rowStyle}>
              <span>Hour</span>
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={hourNow}
                onChange={(e) => set('hour', Number(e.target.value))}
              />
              <span>{hourNow.toFixed(1)}</span>
            </label>
            {select('Season', c.season, SEASONS, (v) => set('season', v))}
            {select('Hemisphere', c.hemisphere, ['north', 'south'] as const, (v) =>
              set('hemisphere', v),
            )}
            {select('Holiday', c.holiday, HOLIDAYS, (v) => set('holiday', v))}
            <label style={rowStyle}>
              <span>Moon phase</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={c.moon ?? 0.5}
                onChange={(e) => set('moon', Number(e.target.value))}
              />
              <span>{(c.moon ?? 0.5).toFixed(2)}</span>
            </label>
            {slider('haze', 'Haze')}
            {slider('algae', 'Algae')}
            {slider('dust', 'Dust')}
            {slider('sparkle', 'Sparkle')}
            {select('Mood', c.mood, MOODS, (v) => set('mood', v))}
            <label style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
              <input
                type="checkbox"
                checked={c.nest}
                onChange={(e) => set('nest', e.target.checked)}
              />{' '}
              Bubble nest
            </label>
            <label style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
              <input
                type="checkbox"
                checked={c.panel}
                onChange={(e) => set('panel', e.target.checked)}
              />{' '}
              Mock panel (exclusion zone)
            </label>
            <label style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
              <input
                type="checkbox"
                checked={c.freeze}
                onChange={(e) => set('freeze', e.target.checked)}
              />{' '}
              Freeze at t = {c.t}s
            </label>
            <fieldset style={{ margin: '8px 0', padding: 6, border: '1px solid #456' }}>
              <legend>Stock</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STOCK_PRESETS.map((p) => (
                  <button key={p.label} type="button" onClick={() => set('stock', p.stock)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ margin: '4px 0', wordBreak: 'break-all' }}>
                {c.stock.length === 0 ? 'betta only' : formatStockParam(c.stock)}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <select
                  aria-label="Species"
                  value={pick.id}
                  onChange={(e) => setPick({ ...pick, id: e.target.value })}
                >
                  <option value="betta">betta</option>
                  {Object.keys(SPECIES).map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Count"
                  type="number"
                  min={1}
                  max={40}
                  value={pick.count}
                  style={{ width: 44 }}
                  onChange={(e) => setPick({ ...pick, count: Number(e.target.value) || 1 })}
                />
                <button
                  type="button"
                  onClick={() =>
                    set('stock', [
                      ...c.stock.filter((x) => x.speciesId !== pick.id),
                      stockEntry(pick.id, pick.count),
                    ])
                  }
                >
                  Add
                </button>
              </div>
            </fieldset>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button type="button" onClick={() => dropPellet()}>
                Pellet
              </button>
              <button type="button" onClick={() => controls.current?.flare()}>
                Flare
              </button>
              <button type="button" onClick={() => controls.current?.focusRandom()}>
                Focus random
              </button>
              <button type="button" onClick={() => controls.current?.inspect()}>
                Idle inspect
              </button>
              <button
                type="button"
                aria-pressed={c.reduced}
                onClick={() => set('reduced', !c.reduced)}
              >
                Reduced motion: {c.reduced ? 'on' : 'off'}
              </button>
            </div>
          </aside>
        ),
        document.body,
      )}
    </>
  )
}
