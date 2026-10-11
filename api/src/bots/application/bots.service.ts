import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { BOT_PASSWORD_MAX_LENGTH, BOT_PASSWORD_MIN_LENGTH, isValidBotPassword } from '../../../../lib/utils/validation'
import { PasswordHasher } from '../../auth/application/ports'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { KnownPoint, Location, MapPoint } from '../../map/domain/map-point.entity'
import { SpawnService } from '../../spawn/application/spawn.service'
import { ModuleFactory } from '../../modules/application/module.factory'
import { ModuleTemplate } from '../../modules/domain/module-catalog'
import { Module } from '../../modules/domain/module.entity'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { Bot } from '../domain/bot.entity'
import { BaseAlreadyExistsError, BaseLostError } from '../domain/bot.errors'
import { BaseLifecycle } from './base-lifecycle'
import { BotRepository } from './bot.repository'
import { ModuleRepository } from '../../modules/application/module.repository'

export interface DeployedBase {
  bot: Bot
  modules: Module[]
  mapPoint: MapPoint
}

export class BotsService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly bots: BotRepository,
    private readonly modules: ModuleRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly moduleFactory: ModuleFactory,
    private readonly lifecycle: BaseLifecycle,
    private readonly spawn: SpawnService
  ) {}

  // Creates the first base of a player on a free cell, with the starting equipment and the access password others
  // need to connect to it
  async deployUserBase(
    user: { id: string; name: string },
    options: { password: string; location?: Location; seedCode?: string }
  ): Promise<DeployedBase> {
    if (!isValidBotPassword(options.password)) {
      throw new ValidationError(
        `The password must have ${BOT_PASSWORD_MIN_LENGTH}-${BOT_PASSWORD_MAX_LENGTH} characters`
      )
    }
    const passwordHash = await this.hasher.hash(options.password)

    return this.unitOfWork.run(async (repositories) => {
      // One living base per player; a corpse base does not count (design §6.3)
      if ((await this.lifecycle.livingBases(user.id, repositories)).length) {
        throw new BaseAlreadyExistsError()
      }

      const bot: Bot = {
        id: this.ids.next(),
        label: `${user.name} base`,
        type: BOT_TYPE.BASE,
        userId: user.id,
        baseId: null,
        passwordHash
      }
      const placement = options.location
        ? { location: options.location, seed: null }
        : await this.spawn.chooseBaseLocation(repositories, { userId: user.id, seedCode: options.seedCode })

      await repositories.bots.add(bot)
      const modules = this.moduleFactory.starterKit(bot.id)
      await repositories.modules.addMany(modules)

      const mapPoint = await repositories.map.upsertPoint({
        id: this.ids.next(),
        location: placement.location,
        type: MapPointType.BASE,
        contentId: bot.id,
        resource: null
      })
      const known: KnownPoint = {
        ...mapPoint,
        id: this.ids.next(),
        userId: user.id,
        seenAt: this.clock.now().getTime()
      }
      await repositories.map.upsertKnownPoints([known])
      await this.spawn.joinSeed(repositories, placement, { userId: user.id, baseId: bot.id })
      await this.lifecycle.syncMapState(user.id, repositories)

      return { bot, modules, mapPoint }
    })
  }

  // A new ordinary bot of one of the player's bases, built from the given modules, placed on a free cell next to the
  // base (design §8.3); with no free cell the bot is not created. The items listed in `consumedItemIds` (the parts
  // the modules were made from) disappear in the same transaction.
  async createBot(
    userId: string,
    input: {
      baseId: string
      label: string | null
      modules: readonly ModuleTemplate[]
      consumedItemIds?: readonly string[]
    }
  ): Promise<{ bot: Bot; modules: Module[]; mapPoint: MapPoint }> {
    const base = await this.getControlledBot(userId, input.baseId)
    if (base.type !== BOT_TYPE.BASE) {
      throw new ValidationError('A bot belongs to a base, not to another bot')
    }
    if (!input.modules.length) {
      throw new ValidationError('A bot needs at least one module')
    }

    return this.unitOfWork.run(async (repositories) => {
      const bot: Bot = {
        id: this.ids.next(),
        label: input.label,
        type: BOT_TYPE.WORKER,
        userId: null,
        baseId: base.id,
        passwordHash: null
      }
      await repositories.bots.add(bot)
      for (const itemId of input.consumedItemIds ?? []) {
        await repositories.items.remove(itemId)
      }
      const modules = input.modules.map((template) => this.moduleFactory.fromTemplate(template, bot.id))
      await repositories.modules.addMany(modules)

      const basePoint = await repositories.map.findPointByContentId(base.id)
      if (!basePoint) {
        throw new NotFoundError('The base is not on the map')
      }
      const cell = await this.spawn.findAdjacentCell(repositories, basePoint.location)
      const mapPoint = await repositories.map.upsertPoint({
        id: this.ids.next(),
        location: cell,
        type: MapPointType.BOT,
        contentId: bot.id,
        resource: null
      })
      await repositories.map.upsertKnownPoints([
        { ...mapPoint, id: this.ids.next(), userId, seenAt: this.clock.now().getTime() }
      ])

      return { bot, modules, mapPoint }
    })
  }

  // The bots of one of the player's bases
  async listBaseBots(userId: string, baseId: string): Promise<Bot[]> {
    const base = await this.getControlledBot(userId, baseId)
    if (base.type !== BOT_TYPE.BASE) {
      throw new ValidationError('The bot is not a base')
    }
    return this.bots.listOfBase(base.id)
  }

  // The bases of the player that live and their bots; corpse bases and stale bots are in no list (design §6.3)
  async listUserBots(userId: string, filter?: { type?: BOT_TYPE }): Promise<Bot[]> {
    const lost = new Set((await this.lifecycle.lostBases(userId, this.reads)).map((base) => base.id))
    const bots = await this.bots.listOfUser(userId, filter)
    return bots.filter((bot) => !lost.has(bot.id) && !(bot.baseId && lost.has(bot.baseId)))
  }

  async getBotModules(userId: string, botId: string): Promise<Module[]> {
    await this.getOwnedBot(userId, botId)
    return this.modules.listOfBot(botId)
  }

  // The bot, provided it belongs to the user: a base through its `userId`, any other bot through its base
  async getOwnedBot(userId: string, botId: string): Promise<Bot> {
    const bot = await this.bots.findById(botId)

    if (!bot) {
      throw new NotFoundError('Bot not found')
    }

    const ownerId = bot.userId ?? (bot.baseId ? ((await this.bots.findById(bot.baseId))?.userId ?? null) : null)

    if (ownerId !== userId) {
      throw new ForbiddenError('The bot belongs to another player')
    }

    return bot
  }

  private get reads() {
    return { bots: this.bots, modules: this.modules }
  }

  // The bot, provided it is the user's and the user still has control of it: its base has not become a corpse
  async getControlledBot(userId: string, botId: string): Promise<Bot> {
    const bot = await this.getOwnedBot(userId, botId)
    if (!(await this.lifecycle.hasControl(bot, this.reads))) {
      throw new BaseLostError()
    }
    return bot
  }
}
