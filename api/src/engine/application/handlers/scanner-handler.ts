import { ok } from '../../../../../lib/utils/result'
import { ScanService } from '../../../bots/application/scan.service'
import { BotState } from '../../domain/bot-state'
import { toJson } from '../json'
import { EventOutbox } from '../event-outbox'
import { RadioBuffers } from '../radio-buffers'
import { RadioNetwork } from '../radio-network'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// scan(): a snapshot of the cells around the bot (design §4.2, §7.2)
export class ScannerHandler implements ScriptFunctionHandler {
  readonly functions = ['scan']

  constructor(
    private readonly scans: ScanService,
    private readonly radio: RadioNetwork,
    private readonly buffers: RadioBuffers,
    private readonly outbox: EventOutbox
  ) {}

  // A bot out of reach of its base still sees what it scans, but the player's map learns of it only when the link returns
  async handle(bot: BotState): Promise<CallOutcome> {
    const { isConnected } = await this.radio.statusOf(bot.ownerId, bot.bot.id)
    const cells = await this.scans.scan(bot.ownerId, bot.bot.id, { remember: isConnected })
    if (!isConnected) {
      cells.forEach((cell) => this.buffers.keepScan(bot.bot.id, cell))
    }
    this.outbox.publish({
      type: 'ScanCompleted',
      at: this.outbox.now(),
      parties: [{ userId: bot.ownerId, botId: bot.bot.id }],
      cells: cells.length
    })
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
