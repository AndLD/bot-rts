import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { FixedRng } from '../../../tests/fakes/fakes'
import { createWorld } from '../../../tests/fakes/world'
import { MODULE_CATALOG, STARTER_KIT } from '../../modules/domain/module-catalog'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { toBotDto } from '../presentation/bot.mapper'
import { BaseAlreadyExistsError } from '../domain/bot.errors'

const PASSWORD = 'secret1'
const alice = { id: '11111111-1111-4111-8111-111111111111', name: 'Alice' }
const bob = { id: '22222222-2222-4222-8222-222222222222', name: 'Bob' }

describe('BotsService.deployUserBase', () => {
  it('creates the base, its starting modules and its map point', async () => {
    // the first base: a square of half-width 60 around the origin; 0.3 * 121 - 60 = -24, 0.6 * 121 - 60 = 12
    const { botsService, repositories } = createWorld({ rng: new FixedRng([0.3, 0.6]) })

    const { bot, modules, mapPoint } = await botsService.deployUserBase(alice, { password: PASSWORD })

    expect(bot).toMatchObject({ label: 'Alice base', type: BOT_TYPE.BASE, userId: alice.id, baseId: null })
    expect(modules.map((module) => module.name)).toEqual(STARTER_KIT)
    expect(modules.every((module) => module.botId === bot.id)).toBe(true)
    expect(mapPoint).toMatchObject({ location: { x: -24, y: 12, z: 0 }, type: MapPointType.BASE, contentId: bot.id })
    expect(repositories.map.known.size).toBe(1)
    expect(await repositories.bots.findById(bot.id)).toEqual(bot)
    expect(await repositories.modules.listOfBot(bot.id)).toEqual(modules)
  })

  it('keeps the access password only as a hash, which the bot DTO never carries', async () => {
    const { botsService } = createWorld()

    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD })

    expect(bot.passwordHash).toBe(`hashed:${PASSWORD}`)
    expect(toBotDto(bot)).not.toHaveProperty('passwordHash')
  })

  it.each(['', 'short', 'x'.repeat(65)])('refuses the password %p', async (password) => {
    const { botsService, repositories } = createWorld()

    await expect(botsService.deployUserBase(alice, { password })).rejects.toThrow(ValidationError)
    expect(repositories.bots.items.size).toBe(0)
  })

  it('places the base at the requested location', async () => {
    const { botsService } = createWorld()

    const { mapPoint } = await botsService.deployUserBase(alice, { password: PASSWORD, location: { x: 7, y: 8, z: 0 } })

    expect(mapPoint.location).toEqual({ x: 7, y: 8, z: 0 })
  })

  it('allows one base per player', async () => {
    const { botsService } = createWorld()
    await botsService.deployUserBase(alice, { password: PASSWORD })

    await expect(botsService.deployUserBase(alice, { password: PASSWORD })).rejects.toThrow(BaseAlreadyExistsError)
  })
})

describe('BotsService queries', () => {
  it('lists the bots of a player', async () => {
    const { botsService } = createWorld()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD })
    await botsService.deployUserBase(bob, { password: PASSWORD, location: { x: 1, y: 1, z: 0 } })

    expect(await botsService.listUserBots(alice.id)).toEqual([bot])
    expect(await botsService.listUserBots(alice.id, { type: BOT_TYPE.WORKER })).toEqual([])
  })

  it('returns the modules of an own base', async () => {
    const { botsService } = createWorld()
    const { bot, modules } = await botsService.deployUserBase(alice, { password: PASSWORD })

    expect(await botsService.getBotModules(alice.id, bot.id)).toEqual(modules)
  })

  it('answers not found and forbidden', async () => {
    const { botsService } = createWorld()
    const { bot } = await botsService.deployUserBase(alice, { password: PASSWORD })

    await expect(botsService.getBotModules(alice.id, 'missing')).rejects.toThrow(NotFoundError)
    await expect(botsService.getBotModules(bob.id, bot.id)).rejects.toThrow(ForbiddenError)
  })

  it('resolves the owner of an ordinary bot through its base', async () => {
    const { botsService, repositories } = createWorld()
    const { bot: base } = await botsService.deployUserBase(alice, { password: PASSWORD })
    const worker = {
      id: 'worker-1',
      label: null,
      type: BOT_TYPE.WORKER,
      userId: null,
      baseId: base.id,
      passwordHash: null
    }
    const orphan = {
      id: 'orphan-1',
      label: null,
      type: BOT_TYPE.WORKER,
      userId: null,
      baseId: null,
      passwordHash: null
    }
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

describe('BotsService.createBot', () => {
  const modules = MODULE_CATALOG.slice(0, 2)

  it('builds a bot of the base from the modules and lists it with the base bots', async () => {
    const { botsService, repositories } = createWorld()
    const { bot: base } = await botsService.deployUserBase(alice, { password: PASSWORD })

    const { bot, modules: attached } = await botsService.createBot(alice.id, {
      baseId: base.id,
      label: 'Digger',
      modules
    })

    expect(bot).toMatchObject({ label: 'Digger', type: BOT_TYPE.WORKER, userId: null, baseId: base.id })
    expect(attached).toHaveLength(2)
    expect(attached.every((module) => module.botId === bot.id)).toBe(true)
    expect(await repositories.modules.listOfBot(bot.id)).toEqual(attached)
    expect(await botsService.listBaseBots(alice.id, base.id)).toEqual([bot])
    expect(await botsService.listUserBots(alice.id)).toContainEqual(bot)
  })

  it('refuses a foreign base, a bot as the owner, and an empty bot', async () => {
    const { botsService } = createWorld()
    const { bot: base } = await botsService.deployUserBase(alice, { password: PASSWORD })
    const { bot: worker } = await botsService.createBot(alice.id, { baseId: base.id, label: null, modules })

    await expect(botsService.createBot(bob.id, { baseId: base.id, label: null, modules })).rejects.toThrow(
      ForbiddenError
    )
    await expect(botsService.createBot(alice.id, { baseId: worker.id, label: null, modules })).rejects.toThrow(
      ValidationError
    )
    await expect(botsService.createBot(alice.id, { baseId: base.id, label: null, modules: [] })).rejects.toThrow(
      ValidationError
    )
  })
})

describe('BotsService.listBaseBots', () => {
  it('answers only for a base the player owns', async () => {
    const { botsService } = createWorld()
    const { bot: base } = await botsService.deployUserBase(alice, { password: PASSWORD })
    const { bot: worker } = await botsService.createBot(alice.id, {
      baseId: base.id,
      label: null,
      modules: MODULE_CATALOG.slice(0, 1)
    })

    await expect(botsService.listBaseBots(bob.id, base.id)).rejects.toThrow(ForbiddenError)
    await expect(botsService.listBaseBots(alice.id, worker.id)).rejects.toThrow(ValidationError)
    await expect(botsService.listBaseBots(alice.id, 'missing')).rejects.toThrow(NotFoundError)
  })
})
