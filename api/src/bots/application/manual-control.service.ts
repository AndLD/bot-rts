import { JsonValue } from '../../engine/domain/json-value'
import { EnginePort } from '../../engine/application/engine-port'

// Manual control (design §15.1): anything a script can ask a bot to do, done by hand. The engine applies it by the rules of a
// script's call and answers with what the script would get.
export class ManualControlService {
  constructor(private readonly engine: Pick<EnginePort, 'manual'>) {}

  perform(userId: string, botId: string, fn: string, args: JsonValue[]): Promise<JsonValue> {
    return this.engine.manual(userId, botId, fn, args)
  }
}
