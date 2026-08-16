/**
 * Simple deterministic simulator for aquarium chemistry time series.
 * Generates pH, ammonia (NH3), nitrite (NO2), nitrate (NO3)
 * with realistic ranges and occasional spikes.
 */
export type SimPoint = { ts: string; value: number }
export type Metric = 'pH' | 'ammonia' | 'nitrite' | 'nitrate'

function mulberry32(seed: number) {
  let t = seed >>> 0
  return function () {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSeries({
  days = 30,
  pointsPerDay = 1,
  seed = 42,
}: {
  days?: number
  pointsPerDay?: number
  seed?: number
}) {
  const rand = mulberry32(seed)
  const now = new Date()
  const total = Math.max(1, Math.floor(days * pointsPerDay))
  const stepMs = (days * 24 * 60 * 60 * 1000) / Math.max(1, total - 1)

  const mk =
    (bias: number, spread: number, clamp: [number, number]) =>
    (n: number, spikeChance = 0, spikeMag = 0) => {
      const wiggle = (rand() - 0.5) * spread
      const spike = rand() < spikeChance ? spikeMag * (rand() + 0.2) : 0
      const v = Math.min(clamp[1], Math.max(clamp[0], bias + wiggle + spike))
      return Number(v.toFixed(n))
    }

  const genPH = mk(7.1, 0.4, [6.2, 8.4])
  const genNH3 = mk(0.02, 0.04, [0, 1.0])
  const genNO2 = mk(0.01, 0.03, [0, 1.0])
  const genNO3 = mk(5, 4, [0, 100])

  const points = Array.from(
    { length: total },
    (_, i) => new Date(now.getTime() - (total - 1 - i) * stepMs),
  )

  const nitrateTrend = (() => {
    let base = 5 + rand() * 5
    return () => (base += rand() * 1.8)
  })()

  const toPoint = (t: Date, value: number): SimPoint => ({ ts: t.toISOString(), value })

  const pH: SimPoint[] = []
  const ammonia: SimPoint[] = []
  const nitrite: SimPoint[] = []
  const nitrate: SimPoint[] = []

  points.forEach((t, idx) => {
    pH.push(toPoint(t, genPH(1)))
    // rare ammonia spikes
    const a = genNH3(2, 0.06, 0.4)
    ammonia.push(toPoint(t, a))
    // nitrite spikes often follow ammonia
    const n2 = a > 0.2 ? Math.max(0, genNO2(2) + rand() * 0.3) : genNO2(2)
    nitrite.push(toPoint(t, Number(n2.toFixed(2))))
    // slow nitrate accumulation with small random walk
    const n3 = nitrateTrend() + (rand() - 0.5) * 2
    nitrate.push(toPoint(t, Number(Math.max(0, n3).toFixed(1))))
  })

  return { pH, ammonia, nitrite, nitrate }
}

export type GeneratedSeries = ReturnType<typeof generateSeries>
