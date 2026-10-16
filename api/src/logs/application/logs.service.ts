import { ILogNode, ILogPage, ISlowTick } from '../../../../lib/utils/admin-logs'
import { EnginePort } from '../../engine/application/engine-port'
import { LogPageRequest, LogQuery, LogStore } from './log-store'

// Looks into the log, wherever it is kept, and the slow ticks of the engine (design §25.3, Logs and audit)
export class LogsService {
  constructor(
    private readonly store: LogStore,
    private readonly engine: EnginePort
  ) {}

  async search(query: LogQuery, page: LogPageRequest): Promise<ILogPage> {
    const { entries, total, capacity } = await this.store.search(query, page)

    return {
      lines: entries.map((entry) => ({ ...entry, at: entry.at.getTime() })),
      total,
      capacity,
      store: this.store.name
    }
  }

  nodes(): Promise<ILogNode[]> {
    return this.store.nodes()
  }

  async slowTicks(): Promise<ISlowTick[]> {
    return (await this.engine.metrics()).slowTicks
  }
}
