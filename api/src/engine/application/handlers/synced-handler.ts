import { BotState } from '../../domain/bot-state'
import { JsonValue } from '../../domain/json-value'
import { CallOutcome, ScriptFunctionHandler } from '../script-api'
import { World } from '../world/world'

// Wraps a handler that works on the database through the use cases (scan, the factory, repairs). The engine writes what it
// holds in memory first, so the use case reads the truth, and forgets what it loaded afterwards, since the use case may have
// changed any of it (design §14.2).
export class SyncedHandler implements ScriptFunctionHandler {
  readonly functions: readonly string[]

  constructor(
    private readonly world: World,
    private readonly inner: ScriptFunctionHandler
  ) {
    this.functions = inner.functions
  }

  async handle(bot: BotState, fn: string, args: readonly JsonValue[]): Promise<CallOutcome> {
    await this.world.sync()
    try {
      return await this.inner.handle(bot, fn, args)
    } finally {
      this.world.evict()
    }
  }
}
