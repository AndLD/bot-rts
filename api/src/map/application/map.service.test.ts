import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { RESOURCE } from '../../../../lib/utils/interfaces/resources'
import { FixedRng } from '../../../tests/fakes/fakes'
import { createWorld } from '../../../tests/fakes/world'

const user = '11111111-1111-4111-8111-111111111111'
const range = { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 1, z: 0 } }

describe('MapService.observe', () => {
  it('stores the blueprint items that lie on new cells and shows them as item cells', async () => {
    // cells in x-major order: empty, then a blueprint (second module), then two empty ones
    const { mapService, repositories } = createWorld({
      rng: new FixedRng([0.9, 0.9, 0.9, 0.001, 0.99, 0.9, 0.9]),
      blueprints: { chance: 0.5, modules: ['scanner-class2', 'gun-class2'] }
    })

    const seen = await mapService.observe(user, range)

    const lying = seen.find((point) => point.type === MapPointType.ITEM)!
    expect(lying.contentId).toEqual(expect.any(String))
    expect(await repositories.items.findById(lying.contentId!)).toMatchObject({
      type: 'blueprint',
      name: 'gun-class2',
      botId: null
    })
    expect(repositories.items.items.size).toBe(1)
  })

  it('generates the missing cells of the real map and returns snapshots of them', async () => {
    // cells are generated in x-major order; a resource cell (roll below 0.2) also rolls its kind and its amount
    const { mapService, repositories, clock } = createWorld({
      rng: new FixedRng([0.1, 0.5, 0.5, 0.9, 0.9, 0.1, 0.99, 0])
    })

    const seen = await mapService.observe(user, range)

    expect(seen.map((p) => [p.location.x, p.location.y, p.type])).toEqual([
      [0, 0, MapPointType.RESOURCE],
      [0, 1, null],
      [1, 0, null],
      [1, 1, MapPointType.RESOURCE]
    ])
    expect(seen[0].resource).toEqual({ resource: RESOURCE.STONE, amount: 175 })
    expect(seen[3].resource).toEqual({ resource: RESOURCE.GOLD, amount: 10 })
    expect(seen[1].resource).toBeNull()
    expect(seen.every((p) => p.userId === user && p.seenAt === clock.current.getTime())).toBe(true)
    expect(repositories.map.points.size).toBe(4)
    expect(repositories.map.known.size).toBe(4)
  })

  it('refreshes existing snapshots instead of duplicating them and keeps real cells as they are', async () => {
    const { mapService, repositories, clock } = createWorld({ rng: new FixedRng([0.9]) })
    const first = await mapService.observe(user, range)

    clock.current = new Date(clock.current.getTime() + 5000)
    const second = await mapService.observe(user, range)

    expect(second.map((p) => p.id)).toEqual(first.map((p) => p.id))
    expect(second.every((p) => p.seenAt === clock.current.getTime())).toBe(true)
    expect(repositories.map.points.size).toBe(4)
  })

  it('shows a changed real cell to the player only when they look again', async () => {
    const { mapService, repositories } = createWorld({ rng: new FixedRng([0.9]) })
    await mapService.observe(user, range)

    const cell = repositories.map.points.get('0:0:0')!
    repositories.map.points.set('0:0:0', { ...cell, type: MapPointType.ITEM, contentId: 'some-item' })

    const known = await repositories.map.findKnownPoint(user, { x: 0, y: 0, z: 0 })
    expect(known?.type).toBeNull()

    const seen = await mapService.observe(user, range)
    expect(seen.find((p) => p.location.x === 0 && p.location.y === 0)).toMatchObject({
      type: MapPointType.ITEM,
      contentId: 'some-item'
    })
  })

  it('can look without writing into the knowledge of the player', async () => {
    const { mapService, repositories } = createWorld()
    const range = { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 1, z: 0 } }

    const looked = await mapService.observe('alice', range, { remember: false })

    expect(looked).toHaveLength(4)
    expect(await repositories.map.findKnownPointsInRange('alice', range)).toEqual([])
    expect(await repositories.map.findPointsInRange(range)).toHaveLength(4)

    await mapService.observe('alice', range)
    expect(await repositories.map.findKnownPointsInRange('alice', range)).toHaveLength(4)
  })

  it('keeps the knowledge of players apart', async () => {
    const { mapService, repositories } = createWorld()
    await mapService.observe(user, range)
    await mapService.observe('22222222-2222-4222-8222-222222222222', { from: range.from, to: range.from })

    expect(repositories.map.known.size).toBe(5)
  })

  it('works a range that spans chunks, negative ones included, and returns the cells in order', async () => {
    const { mapService, repositories } = createWorld({ rng: new FixedRng([0.9]), config: { chunkSize: 2 } })

    const seen = await mapService.observe(user, { from: { x: -1, y: -1, z: 0 }, to: { x: 2, y: 0, z: 0 } })

    expect(seen).toHaveLength(8)
    expect(seen.map((p) => [p.location.x, p.location.y])).toEqual([
      [-1, -1],
      [-1, 0],
      [0, -1],
      [0, 0],
      [1, -1],
      [1, 0],
      [2, -1],
      [2, 0]
    ])
    expect(repositories.map.points.size).toBe(8)
  })
})
