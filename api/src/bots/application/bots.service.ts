import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { BOT_PASSWORD_MAX_LENGTH, BOT_PASSWORD_MIN_LENGTH, isValidBotPassword } from '../../../../lib/utils/validation'
import { PasswordHasher } from '../../auth/application/ports'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { MapRepository } from '../../map/application/map.repository'
import { KnownPoint, Location, MapPoint } from '../../map/domain/map-point.entity'
import { WorldConfig } from '../../map/domain/world-config'
import { ModuleFactory } from '../../modules/application/module.factory'
import { ModuleTemplate } from '../../modules/domain/module-catalog'
import { Module } from '../../modules/domain/module.entity'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Rng } from '../../shared/application/rng'
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/domain/errors'
import { Bot } from '../domain/bot.entity'
import { BaseAlreadyExistsError, BaseLostError, NoFreeLocationError } from '../domain/bot.errors'
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
    private readonly rng: Rng,
    private readonly clock: Clock,
    private readonly world: WorldConfig,
    private readonly hasher: PasswordHasher,
    private readonly moduleFactory: ModuleFactory,
    private readonly lifecycle: BaseLifecycle
  ) {}

  // Creates the first base of a player on a free cell, with the starting equipment and the access password others
  // need to connect to it
  async deployUserBase(
    user: { id: string; name: string },
    options: { password: string; location?: Location }
  ): Promise<DeployedBase> {
    if (!isValidBotPassword(options.password)) {
      throw new ValidationError(
        `The password must have ${BOT_PASSWORD_MIN_LENGTH}-${BOT_PASSWORD_MAX_LENGTH} characters`
      )
    }
    const passwordHash = await this.hasher.hash(options.password)
    const { location } = options

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
      const spot = location ?? (await this.findFreeLocation(repositories.map))

      await repositories.bots.add(bot)
      const modules = this.moduleFactory.starterKit(bot.id)
      await repositories.modules.addMany(modules)

      const mapPoint = await repositories.map.upsertPoint({
        id: this.ids.next(),
        location: spot,
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
      await this.lifecycle.markCorpses(user.id, repositories)

      return { bot, modules, mapPoint }
    })
  }

  // A new ordinary bot of one of the player's bases, built from the given modules. It is not on the map yet: its
  // placement next to the base belongs to the assembly (design §8.3).
  async createBot(
    userId: string,
    input: { baseId: string; label: string | null; modules: readonly ModuleTemplate[] }
  ): Promise<{ bot: Bot; modules: Module[] }> {
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
      const modules = input.modules.map((template) => this.moduleFactory.fromTemplate(template, bot.id))
      await repositories.modules.addMany(modules)
      return { bot, modules }
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

  private async findFreeLocation(map: MapRepository) {
    const limit = this.world.spawnMaxDistance

    for (let attempt = 0; attempt < this.world.spawnAttempts; attempt += 1) {
      const location = { x: this.randomInt(limit), y: this.randomInt(limit), z: 0 }
      const [existing] = await map.findPointsInRange({ from: location, to: location })

      if (!existing?.contentId) {
        return location
      }
    }

    throw new NoFreeLocationError()
  }

  private randomInt(max: number): number {
    return Math.floor(this.rng.next() * (max + 1))
  }
}
