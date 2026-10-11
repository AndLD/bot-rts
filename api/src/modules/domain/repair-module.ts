import { ICraftingBalance, IRecipe } from '../../../../lib/utils/interfaces/crafting'
import { IResourceStack } from '../../../../lib/utils/interfaces/resources'
import { fail, ok, Result, ResultCode } from '../../../../lib/utils/result'
import { GameModule } from './game-module'

// What one repair operation does to a module and what it costs
export interface RepairPlan {
  // The condition the module has afterwards
  condition: number
  // The resources of the repairer's storage it takes
  cost: IResourceStack[]
  // What the repairer keeps afterwards (the cooldown)
  patch: Record<string, unknown>
}

// The repair ("fixing") module (design §8.4.2): works on a module of a bot on an adjacent cell, and costs energy, time
// and resources. Two operations: restoring a module's condition, and taking a module apart into scrap.
export class RepairModule extends GameModule {
  // Condition restored by one operation
  get repairPerOp(): number {
    return this.number('repairPerOp', 0)
  }

  // Cooldown between operations in ms
  get delay(): number {
    return this.number('delay', 0)
  }

  // When the next operation is allowed, in ms of the game clock
  get readyAt(): number {
    return this.number('readyAt', 0)
  }

  // One repair operation on `target` (whose recipe is given), or why it cannot be done. A module can be repaired while
  // it is broken or still healthy enough; one that is damaged below the threshold is too far gone.
  repair(
    target: GameModule,
    recipe: IRecipe,
    now: number,
    balance: Pick<ICraftingBalance, 'repairThreshold' | 'repairCostFactor'>
  ): Result<RepairPlan> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (now < this.readyAt) {
      return fail(ResultCode.COOLDOWN, 'The repair module is cooling down')
    }
    const { condition, maxCondition } = target.record
    if (condition >= maxCondition) {
      return fail(ResultCode.EMPTY, 'The module is not damaged')
    }
    if (condition > 0 && condition < maxCondition * balance.repairThreshold) {
      return fail(ResultCode.TOO_LOW, 'The module is too damaged to repair: disassemble it')
    }

    const restored = Math.min(this.repairPerOp, maxCondition - condition)
    if (restored <= 0) {
      return fail(ResultCode.TOO_LOW, 'The repair module cannot restore anything')
    }
    const share = (restored / maxCondition) * balance.repairCostFactor
    return ok({
      condition: condition + restored,
      cost: recipe.resources.map(({ resource, amount }) => ({ resource, amount: Math.ceil(amount * share) })),
      patch: { readyAt: now + this.delay }
    })
  }

  // Whether the module may be taken apart: a broken module by anybody, a working one only by the owner of its bot, so
  // an attacker cannot strip a bot that still works. Returns what the repairer keeps afterwards (the cooldown).
  disassemble(target: GameModule, isOwnBot: boolean, now: number): Result<{ patch: Record<string, unknown> }> {
    const working = this.ensureWorking()
    if (!working.ok) {
      return working
    }
    if (now < this.readyAt) {
      return fail(ResultCode.COOLDOWN, 'The repair module is cooling down')
    }
    if (target.isWorking && !isOwnBot) {
      return fail(ResultCode.FORBIDDEN, 'Only a broken module of another player can be disassembled')
    }
    return ok({ patch: { readyAt: now + this.delay } })
  }
}

// The scrap of a disassembled module: a share of its recipe resources, `roll` in [0, 1) picks it between the minimum
// and the maximum share
export function scrapOf(
  recipe: IRecipe,
  roll: number,
  balance: Pick<ICraftingBalance, 'scrapMinShare' | 'scrapMaxShare'>
): IResourceStack[] {
  const share = balance.scrapMinShare + roll * (balance.scrapMaxShare - balance.scrapMinShare)
  return recipe.resources
    .map(({ resource, amount }) => ({ resource, amount: Math.floor(amount * share) }))
    .filter(({ amount }) => amount > 0)
}
