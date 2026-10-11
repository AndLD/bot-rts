import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { MapRepository } from '../../map/application/map.repository'
import { KnownPoint, Location, MapPoint } from '../../map/domain/map-point.entity'
import { WorldConfig } from '../../map/domain/world-config'
import { INITIAL_BASE_MODULES } from '../../modules/domain/initial-base-modules'
import { Module } from '../../modules/domain/module.entity'
import { UnitOfWork } from '../../persistence/application/unit-of-work'
import { Clock } from '../../shared/application/clock'
import { IdGenerator } from '../../shared/application/id-generator'
import { Rng } from '../../shared/application/rng'
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors'
import { Bot } from '../domain/bot.entity'
import { BaseAlreadyExistsError, NoFreeLocationError } from '../domain/bot.errors'
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
    private readonly world: WorldConfig
  ) {}

  // Creates the first base of a player on a free cell, with the starting equipment
  deployUserBase(user: { id: string; name: string }, location?: Location): Promise<DeployedBase> {
    return this.unitOfWork.run(async (repositories) => {
      if ((await repositories.bots.listOfUser(user.id)).length) {
        throw new BaseAlreadyExistsError()
      }

      const bot: Bot = {
        id: this.ids.next(),
        label: `${user.name} base`,
        type: BOT_TYPE.BASE,
        userId: user.id,
        baseId: null
      }
      const spot = location ?? (await this.findFreeLocation(repositories.map))

      await repositories.bots.add(bot)
      const modules = INITIAL_BASE_MODULES.map((template) => ({ ...template, id: this.ids.next(), botId: bot.id }))
      await repositories.modules.addMany(modules)

      const mapPoint = await repositories.map.upsertPoint({
        id: this.ids.next(),
        location: spot,
        type: MapPointType.BASE,
        contentId: bot.id
      })
      const known: KnownPoint = {
        ...mapPoint,
        id: this.ids.next(),
        userId: user.id,
        seenAt: this.clock.now().getTime()
      }
      await repositories.map.upsertKnownPoints([known])

      return { bot, modules, mapPoint }
    })
  }

  listUserBots(userId: string, filter?: { type?: BOT_TYPE }): Promise<Bot[]> {
    return this.bots.listOfUser(userId, filter)
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
