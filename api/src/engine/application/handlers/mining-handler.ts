import { MapPointType } from '../../../../../lib/utils/interfaces/map'
import { fail, ok, ResultCode } from '../../../../../lib/utils/result'
import { Location } from '../../../map/domain/map-point.entity'
import { MiningModule, StorageModule } from '../../../modules/domain/game-module'
import { BotState } from '../../domain/bot-state'
import { EventParty } from '../../domain/game-event'
import { ahead, isNeighbour } from '../../domain/heading'
import { JsonValue } from '../../domain/json-value'
import { EventOutbox } from '../event-outbox'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World } from '../world/world'
import { actingPlaced, isFailure } from './acting'

// dig() and mine(x, y): a drill takes `materialPerOperation` of a deposit on the cell ahead, or on a neighbouring cell, into
// the bot's storage (design §9.2). The deposit shrinks at once, so two bots mining one deposit share what is left (§14.1).
export class MiningHandler implements ScriptFunctionHandler {
  readonly functions = ['dig', 'mine']

  constructor(
    private readonly world: World,
    private readonly outbox: EventOutbox
  ) {}

  async handle(state: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const acting = await actingPlaced(this.world, state)
    if (isFailure(acting)) {
      return acting
    }
    const target: Location =
      fn === 'dig'
        ? ahead(acting.position, acting.bot.heading)
        : { x: args[0] as number, y: args[1] as number, z: acting.position.z }
    if (fn === 'mine' && !isNeighbour(acting.position, target)) {
      return fail(ResultCode.OUT_OF_RANGE, 'A drill reaches only the cells next to the bot')
    }

    const [drill] = acting.modules.filter((module): module is MiningModule => module instanceof MiningModule)
    const working = drill.ensureWorking()
    if (!working.ok) {
      return working
    }
    const cell = await this.world.cell(target)
    if (cell.type !== MapPointType.RESOURCE || !cell.resource) {
      return fail(ResultCode.EMPTY, 'There is nothing to mine there')
    }
    const extracted = drill.extract(cell.resource, this.world.hardnessOf(cell.resource.resource))
    if (!extracted.ok) {
      return extracted
    }

    const storages = acting.modules.filter((module): module is StorageModule => module instanceof StorageModule)
    const fitting = storages.map((storage) => ({ storage, added: storage.add(extracted.data) })).find((r) => r.added.ok)
    if (!fitting || !fitting.added.ok) {
      return fail(ResultCode.NO_SPACE, 'The storage cannot hold what the drill would bring up')
    }
    const paid = this.world.spend(acting.bot, drill.record.operationCost)
    if (!paid.ok) {
      return paid
    }

    this.world.updateModules(acting.bot, [fitting.storage.withProps({ items: fitting.added.data })])
    const left = cell.resource.amount - extracted.data.amount
    const base = {
      at: this.outbox.now(),
      parties: [{ userId: state.ownerId, botId: state.bot.id }] as [EventParty],
      location: target
    }
    this.outbox.publish({
      ...base,
      type: 'ResourceMined',
      resource: extracted.data.resource,
      amount: extracted.data.amount
    })
    if (left > 0) {
      this.world.setCell({ ...cell, resource: { ...cell.resource, amount: left } })
    } else {
      this.world.emptyCell(cell)
      this.outbox.publish({ ...base, type: 'DepositDepleted', resource: extracted.data.resource })
    }
    return ok({ resource: extracted.data.resource, amount: extracted.data.amount })
  }
}
