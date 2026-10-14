import { ILogPage, ISlowTick } from '../../../../lib/utils/admin-logs'
import { EnginePort } from '../../engine/application/engine-port'
import { LogBuffer, LogFilter } from '../../shared/application/log-buffer'

// Looks into the recent log of this node and the slow ticks of the engine (design §25.3, Logs and audit)
export class LogsService {
  constructor(
    private readonly buffer: LogBuffer,
    private readonly engine: EnginePort
  ) {}

  search(filter: LogFilter, limit: number): ILogPage {
    const { lines, total } = this.buffer.search(filter, limit)

    return {
      lines: lines.map((line) => ({ ...line, at: line.at.getTime() })),
      total,
      capacity: this.buffer.capacity
    }
  }

  async slowTicks(): Promise<ISlowTick[]> {
    return (await this.engine.metrics()).slowTicks
  }
}
