import { fail, ok, ResultCode } from '../../../../../lib/utils/result'
import { MovementBalance, movementOf } from '../../../bots/domain/movement'
import { EngineModule } from '../../../modules/domain/game-module'
import { BotState } from '../../domain/bot-state'
import { ahead, turned } from '../../domain/heading'
import { JsonValue } from '../../domain/json-value'
import { ScriptMisuseError } from '../../domain/script-misuse'
import { EventOutbox } from '../event-outbox'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World } from '../world/world'
import { actingPlaced, isFailure } from './acting'

// The longest a single move() may be, so that one call cannot keep a bot busy for good
export const MAX_MOVE_CELLS = 64

// move and turn (design §8.5, §10.2): a bot goes forward cell by cell and takes `ticksPerCell` ticks for each
export class MovementHandler implements ScriptFunctionHandler {
  readonly functions = ['move', 'turn']

  constructor(
    private readonly world: World,
    private readonly balance: MovementBalance,
    private readonly outbox: EventOutbox
  ) {}

  async handle(state: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const acting = await actingPlaced(this.world, state)
    if (isFailure(acting)) {
      return acting
    }
    const movement = movementOf(acting.modules, this.balance)
    if (!movement.ok) {
      return movement
    }
    // Every working engine burns its operation cost for each cell and each turn
    const cost = acting.modules
      .filter((module): module is EngineModule => module instanceof EngineModule && module.isWorking)
      .reduce((sum, engine) => sum + engine.record.operationCost, 0)

    if (fn === 'turn') {
      const paid = this.world.spend(acting.bot, cost)
      if (!paid.ok) {
        return paid
      }
      this.world.turn(acting.bot, turned(acting.bot.heading, args[0] as 'left' | 'right'))
      return ok({ heading: acting.bot.heading })
    }

    const cells = args[0] as number
    if (cells < 1 || cells > MAX_MOVE_CELLS) {
      throw new ScriptMisuseError(`move: cells must be between 1 and ${MAX_MOVE_CELLS}`)
    }
    const from = { ...acting.position }
    let moved = 0
    let stopped: ReturnType<typeof fail> | null = null
    while (moved < cells && !stopped) {
      const target = ahead(acting.bot.position as NonNullable<typeof acting.bot.position>, acting.bot.heading)
      const cell = await this.world.cell(target)
      const paid = cell.type === null ? this.world.spend(acting.bot, cost) : null
      if (cell.type !== null) {
        stopped = fail(ResultCode.BLOCKED, `Blocked after ${moved} of ${cells} cells`)
      } else if (paid && !paid.ok) {
        stopped = fail(ResultCode.NO_ENERGY, `Out of energy after ${moved} of ${cells} cells`)
      } else {
        await this.world.place(acting.bot, target)
        moved += 1
      }
    }

    if (moved) {
      const to = acting.bot.position as NonNullable<typeof acting.bot.position>
      this.outbox.publish({
        type: 'BotMoved',
        at: this.outbox.now(),
        parties: [{ userId: state.ownerId, botId: state.bot.id }],
        location: to,
        from,
        to
      })
    }
    const delayTicks = moved * movement.data.ticksPerCell
    this.world.keepBusy(state.bot.id, delayTicks)
    return { ...(stopped ?? ok({ moved })), delayTicks }
  }
}
