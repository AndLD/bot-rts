import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { DEFAULT_RESOURCE_BALANCE, RESOURCE } from '../../../../../lib/utils/interfaces/resources'
import { FixedRng } from '../../../../tests/fakes/fakes'
import { createWorld } from '../../../../tests/fakes/world'
import { buildItem } from '../../../../tests/integration/builders'
import { MapGenerator } from '../../../map/domain/map-generator'
import { DEFAULT_WORLD_CONFIG } from '../../../map/domain/world-config'
import { ServiceBotStateSource } from '../../infrastructure/bot-state.source'
import { RepositoryWorldSource } from './repository-world-source'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }

async function setup() {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: 'secret1',
    location: { x: 5, y: 5, z: 0 }
  })
  const states = new ServiceBotStateSource(world.botsService, world.repositories.bots, world.repositories.modules)
  const source = new RepositoryWorldSource(
    states,
    world.repositories.modules,
    world.repositories.map,
    world.repositories.items,
    new MapGenerator(new FixedRng([0.99]), DEFAULT_WORLD_CONFIG),
    world.ids,
    DEFAULT_RESOURCE_BALANCE
  )
  return { ...world, base, source }
}

describe('RepositoryWorldSource', () => {
  it('loads a bot with its modules, its place, its heading and what it carries', async () => {
    const { source, base, repositories } = await setup()
    const item = buildItem({ botId: base.id })
    await repositories.items.add(item)

    const stored = await source.loadBot(base.id)

    expect(stored?.state.bot.id).toBe(base.id)
    expect(stored?.state.ownerId).toBe(alice.id)
    expect(stored?.position).toEqual({ x: 5, y: 5, z: 0 })
    expect(stored?.heading).toBe(0)
    expect(stored?.carried).toEqual([item])
  })

  it('has no place for a bot that is not on the map, and nothing for one that does not exist', async () => {
    const { source, base, repositories } = await setup()
    repositories.map.points.clear()

    expect((await source.loadBot(base.id))?.position).toBeNull()
    expect(await source.loadBot('missing')).toBeNull()
  })

  it('loads the cells of a range with the items lying on them', async () => {
    const { source, repositories } = await setup()
    const item = buildItem()
    await repositories.items.add(item)
    await repositories.map.addPoints([
      { id: 'p1', location: { x: 6, y: 6, z: 0 }, type: MapPointType.ITEM, contentId: item.id, resource: null }
    ])

    const { points, items } = await source.loadCells({ from: { x: 4, y: 4, z: 0 }, to: { x: 8, y: 8, z: 0 } })

    expect(points.map((p) => p.id).sort()).toEqual([expect.any(String), 'p1'].sort())
    expect(items).toEqual([item])
  })

  it('loads what a player knows of a range and lists the bots with a live scanner', async () => {
    const { source, base, repositories, ids } = await setup()
    await repositories.map.upsertKnownPoints([
      {
        id: ids.next(),
        userId: alice.id,
        location: { x: 5, y: 5, z: 0 },
        type: MapPointType.BASE,
        contentId: base.id,
        resource: null,
        seenAt: 7
      }
    ])

    const known = await source.loadKnown(alice.id, { from: { x: 0, y: 0, z: 0 }, to: { x: 9, y: 9, z: 0 } })
    expect(known).toEqual([expect.objectContaining({ userId: alice.id, seenAt: 7 })])
    expect(await source.loadKnown('someone', { from: { x: 0, y: 0, z: 0 }, to: { x: 9, y: 9, z: 0 } })).toEqual([])

    expect(await source.liveScannerBotIds()).toEqual([])
    const index = repositories.modules.items.findIndex((m) => m.botId === base.id && m.type === 'scanner')
    repositories.modules.items[index] = {
      ...repositories.modules.items[index],
      props: { ...repositories.modules.items[index].props, isLive: true }
    }
    expect(await source.liveScannerBotIds()).toEqual([base.id])
  })

  it('rolls the blueprint item that a new cell may hold with a fresh id', async () => {
    const { ids, botsService, repositories } = await setup()
    const withBlueprints = new RepositoryWorldSource(
      new ServiceBotStateSource(botsService, repositories.bots, repositories.modules),
      repositories.modules,
      repositories.map,
      repositories.items,
      new MapGenerator(new FixedRng([0.99, 0]), DEFAULT_WORLD_CONFIG, { chance: 1, modules: ['gun-class2'] }),
      ids,
      DEFAULT_RESOURCE_BALANCE
    )

    const { point, item } = withBlueprints.generate({ x: 9, y: 9, z: 0 })

    expect(item).toMatchObject({ type: 'blueprint', name: 'gun-class2' })
    expect(point).toMatchObject({ type: 'item', contentId: item?.id })
  })

  it('rolls a new cell with the world generator and knows the hardness of the resources', async () => {
    const { source } = await setup()

    const { point, item } = source.generate({ x: 9, y: 9, z: 0 })

    expect(point).toMatchObject({ location: { x: 9, y: 9, z: 0 }, type: null })
    expect(item).toBeNull()
    expect(source.hardnessOf(RESOURCE.GOLD)).toBe(DEFAULT_RESOURCE_BALANCE.gold.hardness)
  })
})
