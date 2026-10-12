import { ItemType } from '../../../../../lib/utils/interfaces/items'
import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { fail, ok, ResultCode } from '../../../../../lib/utils/result'
import { Location } from '../../../map/domain/map-point.entity'
import { ManipulatorModule } from '../../../modules/domain/game-module'
import { BotState } from '../../domain/bot-state'
import { ahead, isNeighbour } from '../../domain/heading'
import { JsonValue } from '../../domain/json-value'
import { ScriptMisuseError } from '../../domain/script-misuse'
import { toJson } from '../json'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World } from '../world/world'
import { actingPlaced, isFailure } from './acting'

// pick(), take(itemId) and drop(x, y): a manipulator lifts the item on the cell ahead and puts a carried one on a free cell
// ahead or next to the bot (design §9.2). The item is the loser's `GONE` when somebody was first (§14.1).
export class ManipulatorHandler implements ScriptFunctionHandler {
  readonly functions = ['pick', 'take', 'drop']

  constructor(private readonly world: World) {}

  async handle(state: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const acting = await actingPlaced(this.world, state)
    if (isFailure(acting)) {
      return acting
    }
    const manipulators = acting.modules.filter(
      (module): module is ManipulatorModule => module instanceof ManipulatorModule
    )
    const hand = manipulators.find((module) => module.isWorking) ?? manipulators[0]
    const working = hand.ensureWorking()
    if (!working.ok) {
      return working
    }

    if (fn === 'drop') {
      return this.drop(acting.bot, acting.position, hand.record.operationCost, args)
    }
    const capacity = manipulators.filter((m) => m.isWorking).reduce((sum, m) => sum + m.loadCapacity, 0)
    return this.lift(
      acting.bot,
      ahead(acting.position, acting.bot.heading),
      hand.record.operationCost,
      capacity,
      args[0]
    )
  }

  private async lift(
    bot: NonNullable<Awaited<ReturnType<World['bot']>>>,
    target: Location,
    cost: number,
    capacity: number,
    wanted: JsonValue | undefined
  ): Promise<CallOutcome> {
    const cell = await this.world.cell(target)
    const item = cell.type === MapPointType.ITEM && cell.contentId ? this.world.item(cell.contentId) : undefined
    if (!item || (wanted !== undefined && wanted !== null && wanted !== item.id)) {
      return fail(
        wanted ? ResultCode.GONE : ResultCode.EMPTY,
        wanted ? 'That item is not there' : 'There is no item there'
      )
    }
    const carried = bot.carried.reduce((sum, held) => sum + held.weight, 0)
    if (carried + item.weight > capacity) {
      return fail(ResultCode.TOO_HEAVY, 'The manipulator cannot carry more')
    }
    const paid = this.world.spend(bot, cost)
    if (!paid.ok) {
      return paid
    }
    this.world.emptyCell(cell)
    this.world.setItemHolder(item, bot)
    return ok(toJson({ id: item.id, type: item.type, name: item.name, weight: item.weight }))
  }

  private async drop(
    bot: NonNullable<Awaited<ReturnType<World['bot']>>>,
    position: Location,
    cost: number,
    args: readonly JsonValue[]
  ): Promise<CallOutcome> {
    const [x, y] = args
    if ((x === undefined || x === null) !== (y === undefined || y === null)) {
      throw new ScriptMisuseError('drop: give both x and y, or neither')
    }
    const target: Location =
      x === undefined || x === null ? ahead(position, bot.heading) : { x: x as number, y: y as number, z: position.z }
    if (x !== undefined && x !== null && !isNeighbour(position, target)) {
      return fail(ResultCode.OUT_OF_RANGE, 'A manipulator reaches only the cells next to the bot')
    }
    const item = bot.carried[bot.carried.length - 1]
    if (!item) {
      return fail(ResultCode.EMPTY, 'The bot carries nothing')
    }
    const cell = await this.world.cell(target)
    if (cell.type !== null) {
      return fail(ResultCode.BLOCKED, 'The cell is occupied')
    }
    const paid = this.world.spend(bot, cost)
    if (!paid.ok) {
      return paid
    }
    this.world.setCell({ ...cell, type: MapPointType.ITEM, contentId: item.id })
    this.world.setItemHolder(item, null)
    return ok({ itemId: item.id, kind: item.type satisfies ItemType })
  }
}
