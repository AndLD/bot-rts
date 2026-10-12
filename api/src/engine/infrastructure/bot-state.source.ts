import { BotRepository } from '../../bots/application/bot.repository'
import { BotsService } from '../../bots/application/bots.service'
import { ModuleRepository } from '../../modules/application/module.repository'
import { BotState } from '../domain/bot-state'
import { BotStateSource } from '../application/engine-ports'

// What the engine knows of a bot, read through the bot use cases and repositories
export class ServiceBotStateSource implements BotStateSource {
  constructor(
    private readonly botsService: BotsService,
    private readonly bots: BotRepository,
    private readonly modules: ModuleRepository
  ) {}

  async load(botId: string): Promise<BotState | null> {
    const bot = await this.bots.findById(botId)
    if (!bot) {
      return null
    }
    const base = bot.baseId ? await this.bots.findById(bot.baseId) : null
    const ownerId = bot.userId ?? base?.userId ?? null
    return ownerId ? { bot, ownerId, modules: await this.modules.listOfBot(botId) } : null
  }

  async loadControlled(userId: string, botId: string): Promise<BotState> {
    const bot = await this.botsService.getControlledBot(userId, botId)
    return { bot, ownerId: userId, modules: await this.modules.listOfBot(botId) }
  }
}
