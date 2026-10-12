import { LinkGate } from '../../terminal/application/link-gate'
import { EnginePort } from '../application/engine-port'
import { NoSignalError } from '../application/radio-network'

// Asks the engine, which knows the radio network, whether a bot is within reach of its base
export class EngineLinkGate implements LinkGate {
  constructor(private readonly engine: Pick<EnginePort, 'linkStatus'>) {}

  async ensureConnected(userId: string, botId: string): Promise<void> {
    if (!(await this.engine.linkStatus(userId, botId)).isConnected) {
      throw new NoSignalError()
    }
  }
}
