import { fail, ok, ResultCode } from '../../../../../lib/utils/result'
import { GpsModule } from '../../../modules/domain/game-module'
import { BotState } from '../../domain/bot-state'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World } from '../world/world'

// getLocation(): where the bot is, as the engine knows it
export class GpsHandler implements ScriptFunctionHandler {
  readonly functions = ['getLocation']

  constructor(private readonly world: World) {}

  async handle({ bot }: BotState): Promise<CallOutcome> {
    const acting = await this.world.bot(bot.id)
    const gps =
      acting && this.world.modulesOf(acting).find((module): module is GpsModule => module instanceof GpsModule)
    if (!acting || !gps) {
      return fail(ResultCode.NO_MODULE, 'The bot has no GPS module')
    }
    const working = gps.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (!acting.position) {
      return fail(ResultCode.NOT_FOUND, 'The bot is not on the map')
    }
    const paid = this.world.spend(acting, gps.record.operationCost)
    return paid.ok ? ok({ x: acting.position.x, y: acting.position.y }) : paid
  }
}
