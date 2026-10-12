import { ok } from '../../../../../lib/utils/result'
import { BotState } from '../../domain/bot-state'
import { toJson } from '../json'
import { RadioNetwork } from '../radio-network'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// getLinkStatus(): whether the bot reaches its base through the radio network, how strong the signal is (0–4 bars), through how
// many hops, the weakest link of the path and since when the link is lost (design §11.2.1)
export class LinkHandler implements ScriptFunctionHandler {
  readonly functions = ['getLinkStatus']

  constructor(private readonly radio: RadioNetwork) {}

  async handle({ bot, ownerId }: BotState): Promise<CallOutcome> {
    return ok(toJson(await this.radio.statusOf(ownerId, bot.id)))
  }
}
