import { EnginePort } from '../../engine/application/engine-port'
import { HealthCheck } from '../application/health-check'

// The engine is up when it answers a request for its numbers
export class EngineHealthCheck implements HealthCheck {
  readonly component = 'engine'

  constructor(private readonly engine: EnginePort) {}

  async check(): Promise<void> {
    await this.engine.metrics()
  }
}
