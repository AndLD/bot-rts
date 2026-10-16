import { LogBuffer } from '../../shared/application/log-buffer'
import { LogNodeInfo, LogPageRequest, LogQuery, LogSearchResult, LogStore } from '../application/log-store'

// The recent lines of this process, from the ring buffer (`LOG_STORE=memory`, the default and the fallback)
export class MemoryLogStore implements LogStore {
  readonly name = 'memory' as const

  constructor(
    private readonly buffer: LogBuffer,
    private readonly nodeId: string,
    private readonly service: string
  ) {}

  async search(query: LogQuery, { limit, offset }: LogPageRequest): Promise<LogSearchResult> {
    // The buffer holds the lines of this process only, so a filter for another node finds none
    if (query.node !== undefined && query.node !== this.nodeId) {
      return { entries: [], total: 0, capacity: this.buffer.capacity }
    }
    const { lines, total } = this.buffer.search(
      {
        text: query.text,
        mentions: [query.userId, query.botId].filter((id): id is string => id !== undefined),
        level: query.level,
        requestId: query.requestId,
        traceId: query.traceId,
        from: query.from,
        to: query.to
      },
      limit,
      offset
    )

    return {
      entries: lines.map((line) => ({ ...line, node: this.nodeId, service: this.service })),
      total,
      capacity: this.buffer.capacity
    }
  }

  async nodes(): Promise<LogNodeInfo[]> {
    return [{ id: this.nodeId, services: [this.service] }]
  }
}
