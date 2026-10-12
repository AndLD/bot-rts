import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { ItemType } from '../../../../lib/utils/interfaces/items'
import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../../lib/utils/interfaces/resources'
import {
  FakeClock,
  InMemoryBotRepository,
  InMemoryItemRepository,
  InMemoryMapRepository,
  InMemoryModuleRepository
} from '../../../tests/fakes/fakes'
import { buildBase, buildItem, buildKnownPoint, buildModule, buildPoint } from '../../../tests/integration/builders'
import { MapViewService } from './map-view.service'

const userId = 'user-1'
const range = { minX: 0, minY: 0, maxX: 9, maxY: 9 }

function setup() {
  const maps = new InMemoryMapRepository()
  const bots = new InMemoryBotRepository()
  const modules = new InMemoryModuleRepository()
  const items = new InMemoryItemRepository()
  const areas = { areasOf: jest.fn().mockReturnValue([{ scannerId: 's', botId: 'b', x: 1, y: 1, radius: 2 }]) }
  const clock = new FakeClock()
  const service = new MapViewService(maps, bots, modules, items, clock, areas, DEFAULT_RESOURCE_BALANCE)

  const known = (x: number, y: number, overrides = {}) => {
    const point = buildKnownPoint(userId, x, y, overrides)
    maps.known.set(`${userId}:${x},${y},0`, point)
    return point
  }

  return { service, maps, bots, modules, items, areas, clock, known }
}

describe('MapViewService', () => {
  it('shows only what the player has seen, and the live areas', async () => {
    const { service, maps, known, areas } = setup()
    known(1, 1)
    maps.points.set('5,5,0', buildPoint(5, 5, { type: MapPointType.RESOURCE }))
    known(50, 50)

    const view = await service.view(userId, range)

    expect(view.cells.map((cell) => [cell.x, cell.y])).toEqual([[1, 1]])
    expect(view.liveAreas).toHaveLength(1)
    expect(areas.areasOf).toHaveBeenCalledWith(userId)
    expect(view.now).toBe(new Date('2026-06-01T12:00:00.000Z').getTime())
  })

  it("does not show another player's knowledge", async () => {
    const { service, maps } = setup()
    maps.known.set('x', buildKnownPoint('someone-else', 2, 2))

    expect((await service.view(userId, range)).cells).toEqual([])
  })

  it('shows a deposit with how much it held at most', async () => {
    const { service, known } = setup()
    known(2, 2, { type: MapPointType.RESOURCE, contentId: 'r', resource: { resource: RESOURCE.GOLD, amount: 7 } })

    const [cell] = (await service.view(userId, range)).cells

    expect(cell).toMatchObject({
      resource: { resource: 'gold', amount: 7 },
      capacity: DEFAULT_RESOURCE_BALANCE.gold.maxAmount
    })
  })

  it('describes bots by their modules, and tells own from others', async () => {
    const { service, known, bots, modules } = setup()
    const base = buildBase(userId)
    await bots.add(base)
    const ownBot = { ...buildBase(userId), id: 'own-bot', baseId: base.id, userId: null, type: 'worker' as never }
    await bots.add(ownBot)
    await modules.addMany([
      buildModule('own-bot', { type: 'movement', name: 'tracks-class1' }),
      buildModule('own-bot', { type: 'weapon', condition: 10 }),
      buildModule('enemy-bot', { type: 'movement', name: 'wheels-class1' })
    ])
    known(1, 1, { type: MapPointType.BOT, contentId: 'own-bot' })
    known(2, 1, { type: MapPointType.BOT, contentId: 'enemy-bot' })
    known(3, 1, { type: MapPointType.BOT, contentId: 'no-modules' })

    const cells = (await service.view(userId, range)).cells
    const at = (x: number) => cells.find((cell) => cell.x === x)

    expect(at(1)).toMatchObject({ isOwn: true, chassis: 'tracks', icons: ['weapon'], isDamaged: true })
    expect(at(2)).toMatchObject({ isOwn: false, chassis: 'wheels', icons: [], isDamaged: false })
    expect(at(3)).toMatchObject({ isOwn: false, chassis: 'immobile' })
  })

  it('always shows the own bots and bases where they really are, now', async () => {
    const { service, maps, bots, known, clock } = setup()
    const base = buildBase(userId)
    await bots.add(base)
    known(4, 4, { type: MapPointType.BASE, contentId: base.id, seenAt: 1 })
    maps.points.set('6,6,0', buildPoint(6, 6, { type: MapPointType.BASE, contentId: base.id }))
    maps.points.set('7,7,0', buildPoint(7, 7, { type: MapPointType.BOT, contentId: 'stranger' }))

    const view = await service.view(userId, range)

    expect(view.cells).toHaveLength(2)
    expect(view.cells.find((cell) => cell.x === 6)).toMatchObject({
      isOwn: true,
      seenAt: clock.now().getTime(),
      type: MapPointType.BASE
    })
  })

  it('names the kind of an item, or calls it generic when the item is gone', async () => {
    const { service, known, items } = setup()
    const part = buildItem({ type: ItemType.PART })
    await items.add(part)
    known(1, 1, { type: MapPointType.ITEM, contentId: part.id })
    known(2, 1, { type: MapPointType.ITEM, contentId: 'vanished' })

    const cells = (await service.view(userId, range)).cells

    expect(cells.map((cell) => cell.item).sort()).toEqual(['generic', 'part'])
  })

  it('composes cells with no body or item on its own', async () => {
    const { service } = setup()

    expect(
      await service.compose(userId, [
        { location: { x: 0, y: 0 }, type: null, contentId: null, resource: null, seenAt: 3 }
      ])
    ).toEqual([{ x: 0, y: 0, type: null, contentId: null, seenAt: 3 }])
  })

  it.each([
    ['a fraction', { ...range, minX: 0.5 }],
    ['an inverted range', { ...range, minX: 5, maxX: 1 }],
    ['an inverted range in y', { ...range, minY: 5, maxY: 1 }],
    ['too wide', { ...range, maxX: 100 }],
    ['too high', { ...range, maxY: 100 }]
  ])('refuses %s', async (_name, bad) => {
    await expect(setup().service.view(userId, bad)).rejects.toThrow('Invalid map range')
  })

  it('tells where an own bot stands, and nothing about the others or about a bot off the map', async () => {
    const { service, bots, maps } = setup()
    const base = buildBase(userId)
    await bots.add(base)
    maps.points.set('6,7,0', buildPoint(6, 7, { type: MapPointType.BASE, contentId: base.id }))
    const lone = buildBase(userId)
    await bots.add(lone)
    maps.points.set('9,9,0', buildPoint(9, 9, { type: MapPointType.BOT, contentId: 'stranger' }))

    expect(await service.positionOf(userId, base.id)).toEqual({ x: 6, y: 7 })
    await expect(service.positionOf(userId, lone.id)).rejects.toThrow('Bot not found on the map')
    await expect(service.positionOf(userId, 'stranger')).rejects.toThrow('Bot not found on the map')
    await expect(service.positionOf('someone-else', base.id)).rejects.toThrow('Bot not found on the map')
  })
})
