import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { FixedRng } from '../../../tests/fakes/fakes'
import { createWorld } from '../../../tests/fakes/world'
import { INITIAL_BASE_MODULES } from '../../modules/domain/initial-base-modules'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { BaseAlreadyExistsError, NoFreeLocationError } from '../domain/bot.errors'

const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

describe('BotsService.deployUserBase', () => {
  it('creates the base, its starting modules and its map point', async () => {
    // 0.3 * 11 -> 3, 0.6 * 11 -> 6
    const { botsService, repositories } = createWorld({ rng: new FixedRng([0.3, 0.6]) })

    const { bot, modules, mapPoint } = await botsService.deployUserBase(alice)

    expect(bot).toMatchObject({ label: 'Alice base', type: BOT_TYPE.BASE, userId: alice.id, baseId: null })
    expect(modules).toHaveLength(INITIAL_BASE_MODULES.length)
    expect(modules.every((module) => module.botId === bot.id)).toBe(true)
    expect(mapPoint).toMatchObject({ location: { x: 3, y: 6, z: 0 }, type: MapPointType.BASE, contentId: bot.id })
    expect(repositories.map.known.size).toBe(1)
    expect(await repositories.bots.findById(bot.id)).toEqual(bot)
    expect(await repositories.modules.listOfBot(bot.id)).toEqual(modules)
  })

  it('places the base at the requested location', async () => {
    const { botsService } = createWorld()

    const { mapPoint } = await botsService.deployUserBase(alice, { x: 7, y: 8, z: 0 })

    expect(mapPoint.location).toEqual({ x: 7, y: 8, z: 0 })
  })

  it('allows one base per player', async () => {
    const { botsService } = createWorld()
    await botsService.deployUserBase(alice)

    await expect(botsService.deployUserBase(alice)).rejects.toThrow(BaseAlreadyExistsError)
  })

  it('skips occupied cells and fails when none is free', async () => {
    const world = createWorld({
      rng: new FixedRng([0, 0, 0.99, 0.99]),
      config: { spawnMaxDistance: 10, spawnAttempts: 2 }
    })
    await world.botsService.deployUserBase(alice)

    const second = await world.botsService.deployUserBase(bob)
    expect(second.mapPoint.location).toEqual({ x: 10, y: 10, z: 0 })

    const crowded = createWorld({ rng: new FixedRng([0]), config: { spawnAttempts: 3 } })
    await crowded.botsService.deployUserBase(alice)
    await expect(crowded.botsService.deployUserBase(bob)).rejects.toThrow(NoFreeLocationError)
  })
})

describe('BotsService queries', () => {
  it('lists the bots of a player', async () => {
    const { botsService } = createWorld()
    const { bot } = await botsService.deployUserBase(alice)
    await botsService.deployUserBase(bob, { x: 1, y: 1, z: 0 })

    expect(await botsService.listUserBots(alice.id)).toEqual([bot])
    expect(await botsService.listUserBots(alice.id, { type: BOT_TYPE.WORKER })).toEqual([])
  })

  it('returns the modules of an own base', async () => {
    const { botsService } = createWorld()
    const { bot, modules } = await botsService.deployUserBase(alice)

    expect(await botsService.getBotModules(alice.id, bot.id)).toEqual(modules)
  })

  it('answers not found and forbidden', async () => {
    const { botsService } = createWorld()
    const { bot } = await botsService.deployUserBase(alice)

    await expect(botsService.getBotModules(alice.id, 'missing')).rejects.toThrow(NotFoundError)
    await expect(botsService.getBotModules(bob.id, bot.id)).rejects.toThrow(ForbiddenError)
  })

  it('resolves the owner of an ordinary bot through its base', async () => {
    const { botsService, repositories } = createWorld()
    const { bot: base } = await botsService.deployUserBase(alice)
    const worker = { id: 'worker-1', label: null, type: BOT_TYPE.WORKER, userId: null, baseId: base.id }
    const orphan = { id: 'orphan-1', label: null, type: BOT_TYPE.WORKER, userId: null, baseId: null }
    await repositories.bots.add(worker)
    await repositories.bots.add(orphan)

    expect(await botsService.getOwnedBot(alice.id, worker.id)).toEqual(worker)
    await expect(botsService.getOwnedBot(bob.id, worker.id)).rejects.toThrow(ForbiddenError)
    await expect(botsService.getOwnedBot(alice.id, orphan.id)).rejects.toThrow(ForbiddenError)

    const detached = { ...worker, id: 'detached-1', baseId: 'deleted-base' }
    await repositories.bots.add(detached)
    await expect(botsService.getOwnedBot(alice.id, detached.id)).rejects.toThrow(ForbiddenError)
  })
})
