import { ok } from '../../../../../lib/utils/result'
import { ScanService } from '../../../bots/application/scan.service'
import { BotState } from '../../domain/bot-state'
import { toJson } from '../json'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// scan(): a snapshot of the cells around the bot (design §4.2, §7.2)
export class ScannerHandler implements ScriptFunctionHandler {
  readonly functions = ['scan']

  constructor(private readonly scans: ScanService) {}

  async handle(bot: BotState): Promise<CallOutcome> {
    const cells = await this.scans.scan(bot.ownerId, bot.bot.id)
    return ok(
      toJson(
        cells.map(({ location, type, contentId, resource, seenAt }) => ({
          x: location.x,
          y: location.y,
          z: location.z,
          type,
          contentId,
          resource,
          seenAt
        }))
      )
    )
  }
}
