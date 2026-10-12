import { fail, Failure, ResultCode } from '../../../../../lib/utils/result'
import { GameModule } from '../../../modules/domain/game-module'
import { BotState } from '../../domain/bot-state'
import { World, WorldBot } from '../world/world'

// The bot of a call as the world holds it, with its modules as rule classes
export interface Acting {
  bot: WorldBot
  modules: GameModule[]
}

export interface Placed extends Acting {
  position: NonNullable<WorldBot['position']>
}

// The world's copy of the calling bot, which must be on the map and free to act
export async function actingPlaced(world: World, { bot }: BotState): Promise<Placed | Failure> {
  const acting = await world.bot(bot.id)
  if (!acting?.position) {
    return fail(ResultCode.NOT_FOUND, 'The bot is not on the map')
  }
  if (world.isBusy(bot.id)) {
    return fail(ResultCode.BUSY, 'The bot is still moving')
  }
  return { bot: acting, modules: world.modulesOf(acting), position: acting.position }
}

export const isFailure = (value: object): value is Failure => 'ok' in value && (value as Failure).ok === false
