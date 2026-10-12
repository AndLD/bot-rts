import { fail, ok, ResultCode } from '../../../../../lib/utils/result'
import { BatteryModule, GeneratorModule } from '../../../modules/domain/game-module'
import { Clock } from '../../../shared/application/clock'
import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { ScriptMisuseError } from '../../domain/script-misuse'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World } from '../world/world'

// enable(moduleId) and disable(moduleId): switch a generator on or off (it burns oil for energy, design §12.5) or connect and
// disconnect a battery
export class PowerHandler implements ScriptFunctionHandler {
  readonly functions = ['enable', 'disable']

  constructor(
    private readonly world: World,
    private readonly clock: Clock
  ) {}

  async handle({ bot }: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const acting = await this.world.bot(bot.id)
    const module = acting && this.world.modulesOf(acting).find((candidate) => candidate.id === args[0])
    if (!acting || !module) {
      return fail(ResultCode.NOT_FOUND, 'The bot has no such module')
    }
    const isEnabling = fn === 'enable'

    let patch: Record<string, unknown>
    if (module instanceof GeneratorModule) {
      const switched = isEnabling ? module.enable(this.clock.now().getTime()) : ok(module.disable())
      if (!switched.ok) {
        return switched
      }
      patch = switched.data.patch
    } else if (module instanceof BatteryModule) {
      patch = { isConnected: isEnabling }
    } else {
      throw new ScriptMisuseError(`${fn}: the module ${module.name} cannot be switched`)
    }
    this.world.updateModules(acting, [module.withProps(patch)])
    return ok({ moduleId: module.id, isOn: isEnabling })
  }
}
