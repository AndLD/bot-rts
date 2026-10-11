import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { MapPointType } from '../../../../lib/utils/interfaces/map'
import { MapRepository } from '../../map/application/map.repository'
import { ModuleRepository } from '../../modules/application/module.repository'
import { ModuleRegistry } from '../../modules/domain/module-registry'
import { isCorpse } from '../domain/base-state'
import { Bot } from '../domain/bot.entity'
import { BotRepository } from './bot.repository'

type Reads = { bots: BotRepository; modules: ModuleRepository }

// Which bases of a player are alive and which are corpses, and what that means for their bots (design §6.3). The
// repositories are passed in, so a question can be asked inside a transaction.
export class BaseLifecycle {
  constructor(private readonly registry: ModuleRegistry) {}

  async isCorpse(base: Bot, { modules }: Pick<Reads, 'modules'>): Promise<boolean> {
    return isCorpse(this.registry.instantiateAll(await modules.listOfBot(base.id)))
  }

  // The bases of the player that are not corpses (the rule allows one)
  async livingBases(userId: string, repositories: Reads): Promise<Bot[]> {
    const lost = await this.lostBases(userId, repositories)
    const bases = await repositories.bots.listOfUser(userId, { type: BOT_TYPE.BASE })
    return bases.filter((base) => !lost.some((corpse) => corpse.id === base.id))
  }

  async lostBases(userId: string, repositories: Reads): Promise<Bot[]> {
    const bases = await repositories.bots.listOfUser(userId, { type: BOT_TYPE.BASE })
    const states = await Promise.all(bases.map((base) => this.isCorpse(base, repositories)))
    return bases.filter((_, index) => states[index])
  }

  // Whether the owner can still manage the bot: a base while it lives, any other bot while its base lives. The bots
  // of a corpse base are stale and have no active owner.
  async hasControl(bot: Bot, repositories: Reads): Promise<boolean> {
    const base = bot.type === BOT_TYPE.BASE ? bot : bot.baseId ? await repositories.bots.findById(bot.baseId) : null
    return base !== null && !(await this.isCorpse(base, repositories))
  }

  // Shows the corpse bases of the player on the real map as such
  async markCorpses(userId: string, repositories: Reads & { map: MapRepository }): Promise<void> {
    for (const base of await this.lostBases(userId, repositories)) {
      const point = await repositories.map.findPointByContentId(base.id)
      if (point && point.type !== MapPointType.CORPSE_BASE) {
        await repositories.map.upsertPoint({ ...point, type: MapPointType.CORPSE_BASE })
      }
    }
  }
}
