import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { createWorld } from '../../../tests/fakes/world'
import { BaseLifecycle } from './base-lifecycle'
import { BaseLostError } from '../domain/bot.errors'
import { ForbiddenError } from '../../shared/domain/errors'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

// Breaks the wireless adapter of a base, which makes it a corpse
function lose(world: ReturnType<typeof createWorld>, baseId: string) {
  const items = world.repositories.modules.items
  const index = items.findIndex((module) => module.botId === baseId && module.type === 'wirelessAdapter')
  items[index] = { ...items[index], condition: 0 }
}

async function setup() {
  const world = createWorld()
  const { bot: base } = await world.botsService.deployUserBase(alice, {
    password: PASSWORD,
    location: { x: 1, y: 1, z: 0 }
  })
  const { bot: worker } = await world.botsService.createBot(alice.id, {
    baseId: base.id,
    label: 'Digger',
    modules: world.moduleFactory.starterKit('template').slice(1, 2)
  })
  return { ...world, base, worker }
}

describe('BaseLifecycle.hasControl', () => {
  it('is false for a bot without a base, or whose base is gone', async () => {
    const world = await setup()
    const reads = { bots: world.repositories.bots, modules: world.repositories.modules }
    const lifecycle = new BaseLifecycle(world.moduleRegistry)
    const orphan = { ...world.worker, id: 'orphan', baseId: null }
    const detached = { ...world.worker, id: 'detached', baseId: 'gone' }

    expect(await lifecycle.hasControl(world.worker, reads)).toBe(true)
    expect(await lifecycle.hasControl(orphan, reads)).toBe(false)
    expect(await lifecycle.hasControl(detached, reads)).toBe(false)
  })
})

describe('a base that is lost', () => {
  it('is a corpse for its owner: it and its bots are in no list, and the owner cannot control them', async () => {
    const world = await setup()
    lose(world, world.base.id)

    expect(await world.botsService.listUserBots(alice.id)).toEqual([])
    expect(await world.botsService.listUserBots(alice.id, { type: 'base' as never })).toEqual([])
    await expect(world.botsService.getControlledBot(alice.id, world.base.id)).rejects.toThrow(BaseLostError)
    await expect(world.botsService.getControlledBot(alice.id, world.worker.id)).rejects.toThrow(BaseLostError)
    await expect(world.botsService.listBaseBots(alice.id, world.base.id)).rejects.toThrow(BaseLostError)
    await expect(world.terminalService.open(alice.id, world.base.id)).rejects.toThrow(BaseLostError)
    await expect(world.filesService.listDrives(alice.id, world.base.id)).rejects.toThrow(BaseLostError)
  })

  it('can still be looked at: ownership is not control', async () => {
    const world = await setup()
    lose(world, world.base.id)

    expect(await world.botsService.getOwnedBot(alice.id, world.base.id)).toEqual(world.base)
    expect((await world.botsService.getBotModules(alice.id, world.base.id)).length).toBeGreaterThan(0)
    await expect(world.botsService.getControlledBot(bob.id, world.base.id)).rejects.toThrow(ForbiddenError)
  })

  it('is a living base again whenever its adapter works: the state is derived, not stored', async () => {
    const world = await setup()
    lose(world, world.base.id)
    const items = world.repositories.modules.items
    const index = items.findIndex((m) => m.botId === world.base.id && m.type === 'wirelessAdapter')
    items[index] = { ...items[index], condition: 40 }

    expect(await world.botsService.listUserBots(alice.id)).toHaveLength(2)
    expect(await world.botsService.getControlledBot(alice.id, world.base.id)).toEqual(world.base)
  })

  it('lets the owner deploy a new base, which leaves the old one as a corpse base on the map', async () => {
    const world = await setup()
    lose(world, world.base.id)

    const redeployed = await world.botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 40, y: 40, z: 0 }
    })

    expect(redeployed.bot.id).not.toBe(world.base.id)
    expect(await world.botsService.listUserBots(alice.id)).toEqual([redeployed.bot])
    expect(await world.repositories.map.findPointByContentId(world.base.id)).toMatchObject({
      type: MapPointType.CORPSE_BASE
    })
    expect(await world.repositories.map.findPointByContentId(redeployed.bot.id)).toMatchObject({
      type: MapPointType.BASE
    })
  })

  it('marks each corpse once, however many times the player redeploys, and copes with a base off the map', async () => {
    const world = await setup()
    lose(world, world.base.id)
    const second = await world.botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 40, y: 40, z: 0 }
    })
    lose(world, second.bot.id)
    world.repositories.map.points.delete('1:1:0')

    await world.botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 80, y: 80, z: 0 } })

    expect(await world.repositories.map.findPointByContentId(second.bot.id)).toMatchObject({
      type: MapPointType.CORPSE_BASE
    })
    expect(await world.repositories.map.findPointByContentId(world.base.id)).toBeNull()
  })

  it('keeps its stale bots out of the new base: they are not adopted by it', async () => {
    const world = await setup()
    lose(world, world.base.id)
    const { bot: fresh } = await world.botsService.deployUserBase(alice, {
      password: PASSWORD,
      location: { x: 40, y: 40, z: 0 }
    })

    expect(await world.botsService.listBaseBots(alice.id, fresh.id)).toEqual([])
    expect((await world.repositories.bots.findById(world.worker.id))?.baseId).toBe(world.base.id)
  })

  it('still refuses a second base while the first one lives', async () => {
    const world = await setup()

    await expect(
      world.botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 40, y: 40, z: 0 } })
    ).rejects.toThrow('User base already exists')
  })

  it('treats a bot whose base is gone as out of control', async () => {
    const world = await setup()
    world.repositories.bots.items.delete(world.base.id)

    await expect(world.botsService.getControlledBot(alice.id, world.worker.id)).rejects.toThrow()
  })
})
