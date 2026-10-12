import { ok } from '../../../../../lib/utils/result'
import { MaintenanceService } from '../../../bots/application/maintenance.service'
import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { toJson } from '../json'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// repair and disassemble: a module of a bot on an adjacent cell (design §8.4.2)
export class MaintenanceHandler implements ScriptFunctionHandler {
  readonly functions = ['repair', 'disassemble']

  constructor(private readonly maintenance: MaintenanceService) {}

  async handle({ bot, ownerId }: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const order = { repairerId: bot.id, targetBotId: args[0] as string, moduleId: args[1] as string }
    return ok(
      toJson(
        fn === 'repair'
          ? await this.maintenance.repair(ownerId, order)
          : await this.maintenance.disassemble(ownerId, order)
      )
    )
  }
}
