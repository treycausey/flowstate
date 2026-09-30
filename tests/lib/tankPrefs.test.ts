import 'fake-indexeddb/auto'
import { getSettings, setSettings } from '@/lib/idb'
import { DEFAULT_PREFS, loadTankPrefs, onTankPrefsChanged, saveTankPrefs } from '@/lib/tank/prefs'

describe('tank prefs', () => {
  it('defaults to the tank on, northern hemisphere', async () => {
    expect(await loadTankPrefs()).toEqual(DEFAULT_PREFS)
  })

  it('persists changes, keeps other settings, and notifies listeners', async () => {
    await setSettings({ theme: 'dark' })
    const seen: boolean[] = []
    const off = onTankPrefsChanged((p) => seen.push(p.livingTank))
    await saveTankPrefs({ livingTank: false, hemisphere: 'south' })
    off()
    expect(seen).toEqual([false])
    expect(await loadTankPrefs()).toMatchObject({ livingTank: false, hemisphere: 'south' })
    expect((await getSettings())?.theme).toBe('dark')
  })

  it('remembers which tanks saw the 100th-reading shimmer', async () => {
    await saveTankPrefs({ shimmerSeen: ['t1'] })
    expect((await loadTankPrefs()).shimmerSeen).toEqual(['t1'])
  })

  it('keeps both keys when two saves are fired without awaiting', async () => {
    await saveTankPrefs({ livingTank: true, hemisphere: 'north' })
    await Promise.all([
      saveTankPrefs({ livingTank: false }),
      saveTankPrefs({ hemisphere: 'south' }),
    ])
    expect(await loadTankPrefs()).toMatchObject({ livingTank: false, hemisphere: 'south' })
  })
})
