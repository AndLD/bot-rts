import { IBot } from '../../../../lib/utils/interfaces/bots'
import { Bot } from '../domain/bot.entity'

export function toBotDto(bot: Bot): IBot {
  return {
    _id: bot.id,
    label: bot.label ?? undefined,
    userId: bot.userId ?? undefined,
    baseId: bot.baseId ?? undefined,
    type: bot.type
  }
}
