import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { EngineModule, GameModule, MovementModule } from '../../modules/domain/game-module'

// The tunable numbers of movement (design §8.5)
export interface MovementBalance {
  // However heavy the bot, a cell never takes longer than this
  maxTicksPerCell: number
}

export const DEFAULT_MOVEMENT_BALANCE: MovementBalance = { maxTicksPerCell: 20 }

export interface MovementStats {
  totalWeight: number
  ticksPerCell: number
}

// The weight of everything attached to the bot, broken modules included
export function totalWeight(modules: readonly GameModule[]): number {
  return modules.reduce((sum, module) => sum + module.record.weight, 0)
}

// Whether a bot with these modules can move, and how fast: it needs a working engine and a working chassis (wheels or
// tracks) that can carry its weight; a stronger engine or a lighter bot takes fewer ticks per cell (design §8.5)
export function movementOf(
  modules: readonly GameModule[],
  balance: MovementBalance = DEFAULT_MOVEMENT_BALANCE
): Result<MovementStats> {
  const engines = modules.filter((module): module is EngineModule => module instanceof EngineModule)
  const chassis = modules.filter((module): module is MovementModule => module instanceof MovementModule)

  if (!engines.length || !chassis.length) {
    return fail(ResultCode.NO_MODULE, 'Moving takes an engine and wheels or tracks')
  }
  const engine = engines.filter((module) => module.isWorking)
  const wheels = chassis.filter((module) => module.isWorking)
  if (!engine.length || !wheels.length) {
    return fail(ResultCode.BROKEN_MODULE, 'The engine or the wheels are broken')
  }

  const speed = engine.reduce((sum, module) => sum + module.speed, 0)
  if (speed <= 0) {
    return fail(ResultCode.TOO_LOW, 'The engine is too weak to move')
  }
  const weight = totalWeight(modules)
  if (weight > wheels.reduce((sum, module) => sum + module.loadCapacity, 0)) {
    return fail(ResultCode.TOO_HEAVY, 'The bot is too heavy for its wheels or tracks')
  }

  const ticks = Math.min(Math.max(Math.ceil(weight / speed), 1), balance.maxTicksPerCell)
  return ok({ totalWeight: weight, ticksPerCell: ticks })
}
