import { ModuleType } from '../../../../lib/utils/interfaces/modules'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { EngineModule, GameModule, MovementModule } from '../../modules/domain/game-module'
import { MovementBalance, DEFAULT_MOVEMENT_BALANCE, movementOf } from './movement'

// What every bot needs (design §8.2): scripts run on a processor, the control block gives identity and the radio
// link, the battery powers them
const REQUIRED: readonly { type: ModuleType; description: string }[] = [
  { type: 'processor', description: 'a processor' },
  { type: 'wirelessAdapter', description: 'a wireless adapter' },
  { type: 'battery', description: 'a battery' }
]

// Whether these modules make a legal bot: the required ones, and for a bot that moves an engine with wheels or
// tracks strong enough to carry it. A bot with neither engine nor chassis is a legal stationary bot.
export function validateAssembly(
  modules: readonly GameModule[],
  balance: MovementBalance = DEFAULT_MOVEMENT_BALANCE
): Result {
  const missing = REQUIRED.filter(({ type }) => !modules.some((module) => module.type === type))
  if (missing.length) {
    return fail(ResultCode.NO_MODULE, `A bot needs ${missing.map(({ description }) => description).join(', ')}`)
  }

  const isMobile = modules.some((module) => module instanceof EngineModule || module instanceof MovementModule)
  if (isMobile) {
    const movement = movementOf(modules, balance)
    if (!movement.ok) {
      return movement
    }
  }
  return ok()
}
