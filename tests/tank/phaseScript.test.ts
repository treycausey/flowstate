import { phaseAt } from '@/lib/tank/environment'
import { PHASE_SCRIPT } from '@/lib/tank/phaseScript'

function scriptPhaseAt(hour: number, minute: number): string | null {
  document.documentElement.removeAttribute('data-tank-phase')
  const RealDate = Date
  const fixed = new RealDate(2026, 5, 15, hour, minute, 0)
  // The script calls `new Date()`; pin it to the wanted local time.
  globalThis.Date = class extends RealDate {
    constructor() {
      super(fixed.getTime())
    }
  } as DateConstructor
  try {
    new Function(PHASE_SCRIPT)()
  } finally {
    globalThis.Date = RealDate
  }
  return document.documentElement.getAttribute('data-tank-phase')
}

describe('pre-paint phase script', () => {
  afterEach(() => document.documentElement.removeAttribute('data-tank-phase'))

  it('matches phaseAt for every 15 minutes of the day', () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 15, 30, 45]) {
        expect({ at: `${h}:${m}`, phase: scriptPhaseAt(h, m) }).toEqual({
          at: `${h}:${m}`,
          phase: phaseAt(h + m / 60).phase,
        })
      }
    }
  })
})
