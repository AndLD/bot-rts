import { ok } from '../../../../../lib/utils/result'
import { AssemblyService } from '../../../bots/application/assembly.service'
import { FactoryService } from '../../../bots/application/factory.service'
import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { toJson } from '../json'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'

// craft, assemble, research and learn: the same use cases as the terminal and the factory screen (design §9.3). The
// factory is the module of the base, so the calling bot is the base.
export class FactoryHandler implements ScriptFunctionHandler {
  readonly functions = ['craft', 'assemble', 'research', 'learn']

  constructor(
    private readonly factory: FactoryService,
    private readonly assembly: AssemblyService
  ) {}

  async handle({ bot, ownerId }: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    switch (fn) {
      case 'craft':
        return ok(
          toJson(await this.factory.craft(ownerId, bot.id, args[0] as string, (args[1] as number) ?? undefined))
        )
      case 'assemble': {
        const built = await this.assembly.assemble(ownerId, {
          baseId: bot.id,
          label: args[0] as string | null,
          partIds: args[1] as string[]
        })
        return ok(toJson({ botId: built.bot.id }))
      }
      case 'research':
        return ok(toJson(await this.factory.research(ownerId, bot.id, args[0] as string)))
      default:
        return ok(toJson(await this.factory.learn(ownerId, bot.id, args[0] as string)))
    }
  }
}
