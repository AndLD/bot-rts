import { fail, ok, ResultCode } from '../../../../../lib/utils/result'
import { MapRepository } from '../../../map/application/map.repository'
import { EnergyService } from '../../../modules/application/energy.service'
import { ModuleRepository } from '../../../modules/application/module.repository'
import { GpsModule } from '../../../modules/domain/game-module'
import { ModuleRegistry } from '../../../modules/domain/module-registry'
import { BotState } from '../../domain/bot-state'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// getLocation(): where the bot is
export class GpsHandler implements ScriptFunctionHandler {
  readonly functions = ['getLocation']

  constructor(
    private readonly modules: ModuleRepository,
    private readonly registry: ModuleRegistry,
    private readonly map: MapRepository,
    private readonly energy: EnergyService
  ) {}

  async handle({ bot }: BotState): Promise<CallOutcome> {
    const [gps] = this.registry.instancesOf(await this.modules.listOfBot(bot.id), GpsModule)
    if (!gps) {
      return fail(ResultCode.NO_MODULE, 'The bot has no GPS module')
    }
    const working = gps.ensureWorking()
    if (!working.ok) {
      return working
    }
    const point = await this.map.findPointByContentId(bot.id)
    if (!point) {
      return fail(ResultCode.NOT_FOUND, 'The bot is not on the map')
    }
    await this.energy.pay(bot.id, gps.record.operationCost)
    return ok({ x: point.location.x, y: point.location.y })
  }
}
