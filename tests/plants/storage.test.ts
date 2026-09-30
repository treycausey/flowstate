import 'fake-indexeddb/auto'
import {
  addPlant,
  addPlantCheck,
  addReading,
  archiveTank,
  createTank,
  deletePlant,
  exportDump,
  importDump,
  listPlantChecksByTank,
  listPlantsByTank,
  listReadingsByTank,
  listTanks,
  updatePlant,
} from '@/lib/idb'

const base = { speciesId: 'java-fern', name: 'Java fern', placement: 'epiphyte' as const }

describe('plants in IndexedDB', () => {
  it('stores plants per tank, in planting order, with UTC timestamps', async () => {
    const a = await createTank('Plants A')
    const b = await createTank('Plants B')
    await addPlant({ ...base, tankId: a.id, plantedAt: '2026-03-02T09:00:00.000-08:00' })
    await addPlant({
      ...base,
      tankId: a.id,
      name: 'Earlier',
      plantedAt: '2026-03-01T12:00:00.000Z',
    })
    await addPlant({ ...base, tankId: b.id, plantedAt: '2026-03-01T00:00:00.000Z' })

    const plants = await listPlantsByTank(a.id)
    expect(plants.map((p) => p.name)).toEqual(['Earlier', 'Java fern'])
    expect(plants[1].plantedAt).toBe('2026-03-02T17:00:00.000Z')
    expect(plants.every((p) => p.tankId === a.id)).toBe(true)
    expect(plants.every((p) => !p.removedAt)).toBe(true)
    expect(await listPlantsByTank(b.id)).toHaveLength(1)
  })

  it('trims names and keeps custom plants (no species)', async () => {
    const t = await createTank('Custom')
    const custom = await addPlant({
      tankId: t.id,
      speciesId: null,
      name: '  Mystery stem  ',
      placement: 'background',
      plantedAt: '2026-04-01T00:00:00.000Z',
      note: 'from a friend',
    })
    expect(custom.name).toBe('Mystery stem')
    const [stored] = await listPlantsByTank(t.id)
    expect(stored).toMatchObject({ speciesId: null, note: 'from a friend', name: 'Mystery stem' })
  })

  it('removes and restores without losing history, and edits in place', async () => {
    const t = await createTank('Remove')
    const plant = await addPlant({ ...base, tankId: t.id, plantedAt: '2026-05-01T00:00:00.000Z' })
    await addPlantCheck({
      plantId: plant.id,
      tankId: t.id,
      ts: '2026-05-02T00:00:00.000Z',
      health: 'ok',
      symptoms: [],
    })

    await updatePlant({ ...plant, removedAt: '2026-05-10T10:00:00.000-05:00' })
    let [stored] = await listPlantsByTank(t.id)
    expect(stored.removedAt).toBe('2026-05-10T15:00:00.000Z')
    expect(await listPlantChecksByTank(t.id)).toHaveLength(1)

    await updatePlant({ ...stored, removedAt: null, name: 'Java fern on wood' })
    ;[stored] = await listPlantsByTank(t.id)
    expect(stored.removedAt).toBeNull()
    expect(stored.name).toBe('Java fern on wood')
  })

  it('stores checks oldest first with UTC timestamps, symptoms and actions', async () => {
    const t = await createTank('Checks')
    const plant = await addPlant({ ...base, tankId: t.id, plantedAt: '2026-06-01T00:00:00.000Z' })
    await addPlantCheck({
      plantId: plant.id,
      tankId: t.id,
      ts: '2026-06-10T09:00:00.000-08:00',
      health: 'struggling',
      symptoms: ['pinholes', 'brown-edges'],
      action: 'trimmed',
      note: 'edges',
    })
    await addPlantCheck({
      plantId: plant.id,
      tankId: t.id,
      ts: '2026-06-10T12:00:00.000Z',
      health: 'ok',
      symptoms: [],
    })
    const checks = await listPlantChecksByTank(t.id)
    expect(checks.map((c) => c.ts)).toEqual([
      '2026-06-10T12:00:00.000Z',
      '2026-06-10T17:00:00.000Z',
    ])
    expect(checks[1]).toMatchObject({
      health: 'struggling',
      symptoms: ['pinholes', 'brown-edges'],
      action: 'trimmed',
      note: 'edges',
    })
  })

  it('deletes a plant together with its checks, and only its own', async () => {
    const t = await createTank('Delete')
    const keep = await addPlant({
      ...base,
      name: 'Keep',
      tankId: t.id,
      plantedAt: '2026-06-01T00:00:00.000Z',
    })
    const drop = await addPlant({
      ...base,
      name: 'Drop',
      tankId: t.id,
      plantedAt: '2026-06-02T00:00:00.000Z',
    })
    for (const p of [keep, drop]) {
      await addPlantCheck({
        plantId: p.id,
        tankId: t.id,
        ts: '2026-06-03T00:00:00.000Z',
        health: 'ok',
        symptoms: [],
      })
      await addPlantCheck({
        plantId: p.id,
        tankId: t.id,
        ts: '2026-06-04T00:00:00.000Z',
        health: 'ok',
        symptoms: [],
      })
    }
    await deletePlant(drop.id)
    expect((await listPlantsByTank(t.id)).map((p) => p.name)).toEqual(['Keep'])
    const checks = await listPlantChecksByTank(t.id)
    expect(checks).toHaveLength(2)
    expect(checks.every((c) => c.plantId === keep.id)).toBe(true)
  })

  it('keeps plants and their checks when a tank is archived, like its readings', async () => {
    const t = await createTank('Archive')
    const plant = await addPlant({ ...base, tankId: t.id, plantedAt: '2026-06-01T00:00:00.000Z' })
    await addPlantCheck({
      plantId: plant.id,
      tankId: t.id,
      ts: '2026-06-03T00:00:00.000Z',
      health: 'ok',
      symptoms: [],
    })
    await addReading({
      tankId: t.id,
      ts: '2026-06-03T00:00:00.000Z',
      pH: 7,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
    })
    await archiveTank(t.id)
    expect((await listTanks()).find((x) => x.id === t.id)?.archivedAt).toBeTruthy()
    expect(await listReadingsByTank(t.id)).toHaveLength(1)
    expect(await listPlantsByTank(t.id)).toHaveLength(1)
    expect(await listPlantChecksByTank(t.id)).toHaveLength(1)
  })

  it('round-trips plants and checks through export and import', async () => {
    const t = await createTank('Dump')
    const plant = await addPlant({ ...base, tankId: t.id, plantedAt: '2026-07-01T00:00:00.000Z' })
    await addPlantCheck({
      plantId: plant.id,
      tankId: t.id,
      ts: '2026-07-02T00:00:00.000Z',
      health: 'melting',
      symptoms: ['melting', 'transparent-leaves'],
      action: 'none',
    })
    const dump = await exportDump()
    expect(dump.plants?.some((p) => p.id === plant.id)).toBe(true)
    expect(dump.plantChecks?.some((c) => c.plantId === plant.id)).toBe(true)

    await deletePlant(plant.id)
    expect(await listPlantsByTank(t.id)).toHaveLength(0)
    await importDump(JSON.parse(JSON.stringify(dump)))
    const [restored] = await listPlantsByTank(t.id)
    expect(restored).toMatchObject({ id: plant.id, name: 'Java fern' })
    const [check] = await listPlantChecksByTank(t.id)
    expect(check).toMatchObject({ plantId: plant.id, health: 'melting', action: 'none' })
  })

  it('imports a backup made before plants existed and leaves plants alone', async () => {
    const t = await createTank('Old backup target')
    await addPlant({ ...base, tankId: t.id, plantedAt: '2026-07-01T00:00:00.000Z' })
    await importDump({
      tanks: [{ id: 'old-1', name: 'Old', createdAt: '2025-01-01T00:00:00.000Z' }],
      readings: [
        {
          id: 'old-r',
          tankId: 'old-1',
          ts: '2025-01-02T00:00:00.000Z',
          pH: 7,
          ammonia: 0,
          nitrite: 0,
          nitrate: 5,
        },
      ],
    })
    expect((await listReadingsByTank('old-1')).length).toBe(1)
    expect(await listPlantsByTank('old-1')).toEqual([])
    expect(await listPlantsByTank(t.id)).toHaveLength(1)
  })

  it('rejects a backup with a plant on an unknown tank without writing anything', async () => {
    const before = await exportDump()
    await expect(
      importDump({
        tanks: [{ id: 'bad-t', name: 'Bad', createdAt: '2025-01-01T00:00:00.000Z' }],
        readings: [],
        plants: [
          {
            id: 'bad-p',
            tankId: 'nope',
            name: 'X',
            placement: 'midground',
            plantedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow(/unknown tank/)
    const after = await exportDump()
    expect(after.tanks).toHaveLength(before.tanks.length)
    expect(after.plants).toHaveLength(before.plants?.length ?? 0)
  })
})
