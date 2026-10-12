import { BOT_TYPE } from '../../../../lib/utils/interfaces/bots'
import { Location } from '../../../../lib/utils/interfaces/map'
import { Bot } from '../domain/bot.entity'

export const BOT_REPOSITORY = Symbol('BotRepository')

export interface BotRepository {
  findById(id: string): Promise<Bot | null>
  add(bot: Bot): Promise<void>
  // The bases of the user, plus every bot of those bases unless `type` narrows the result
  listOfUser(userId: string, filter?: { type?: BOT_TYPE }): Promise<Bot[]>
  listOfBase(baseId: string): Promise<Bot[]>
  // Remembers where a bot without modules was, now that its cell is empty
  setLastPosition(botId: string, position: Location): Promise<void>
  setPasswordHash(botId: string, passwordHash: string): Promise<void>
  // The bot now belongs to another base (design §11.2.2, adopt)
  setBase(botId: string, baseId: string): Promise<void>
}
