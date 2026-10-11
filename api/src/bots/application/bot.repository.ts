import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { Bot } from '../domain/bot.entity'

export const BOT_REPOSITORY = Symbol('BotRepository')

export interface BotRepository {
  findById(id: string): Promise<Bot | null>
  add(bot: Bot): Promise<void>
  // The bases of the user, plus every bot of those bases unless `type` narrows the result
  listOfUser(userId: string, filter?: { type?: BOT_TYPE }): Promise<Bot[]>
  listOfBase(baseId: string): Promise<Bot[]>
}
