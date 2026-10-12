import { AccessState } from '../domain/bot-security'

export const BOT_ACCESS_REPOSITORY = Symbol('BotAccessRepository')

export interface BotAccessRepository {
  // What the bot remembers of the attempts to connect to it; nothing for a bot nobody tried
  find(botId: string): Promise<AccessState | null>
  save(botId: string, state: AccessState): Promise<void>
}
