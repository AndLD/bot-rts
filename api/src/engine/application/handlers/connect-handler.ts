import { ok } from '../../../../../lib/utils/result'
import { BotAccessService } from '../../../terminal/application/bot-access.service'
import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { EventOutbox } from '../event-outbox'
import { failedAttemptEvent } from '../world-action-events'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// connect(botId, password?): opens a link to another bot (design §10.2, §11.2.2) with the rules of the terminal's `connect`:
// the bot of the player itself needs no password; a bot of someone else needs its password, costs energy per attempt, and
// locks out after too many wrong ones. A wrong password is news for the owner of the target.
export class ConnectHandler implements ScriptFunctionHandler {
  readonly functions = ['connect']

  constructor(
    private readonly access: BotAccessService,
    private readonly outbox: EventOutbox
  ) {}

  async handle({ bot, ownerId }: BotState, _fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    const targetId = args[0] as string
    const password = args[1] as string | undefined

    try {
      const connection = await this.access.connect(ownerId, bot.id, targetId, password)
      return ok({ botId: connection.bot.id, isForeign: connection.isForeign })
    } catch (error) {
      const event = failedAttemptEvent(error, ownerId, bot.id, this.outbox.now())
      if (event) {
        this.outbox.publish(event)
      }
      throw error
    }
  }
}
