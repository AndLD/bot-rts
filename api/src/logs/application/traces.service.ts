import { ITraceView, LOG_PAGE_MAX } from '../../../../lib/utils/admin-logs'
import { NotFoundError } from '../../shared/domain/errors'
import { LogStore } from './log-store'
import { TraceStore } from './trace-store'

const TRACE_ID = /^[0-9a-f]{32}$/
// The lines of a trace are looked for a little before its first span and after its last
const MARGIN_MS = 60_000

// Follows one request over the nodes (design §25.3): its spans and every log line written in it, in order. It is found by its trace
// id or, for the logs of before the trace ids, by the request id.
export class TracesService {
  constructor(
    private readonly traces: TraceStore,
    private readonly logs: LogStore
  ) {}

  async read(id: string): Promise<ITraceView> {
    const traceId = TRACE_ID.test(id) ? id : await this.traceOfRequest(id)
    const spans = await this.traces.spans(traceId)
    const times = spans.flatMap((span) => [span.startedAt.getTime(), span.startedAt.getTime() + span.durationMs])
    const window = times.length
      ? { from: new Date(Math.min(...times) - MARGIN_MS), to: new Date(Math.max(...times) + MARGIN_MS) }
      : {}
    const found = await this.logs.search({ traceId, ...window }, { limit: LOG_PAGE_MAX, offset: 0 })

    if (spans.length === 0 && found.entries.length === 0) {
      throw new NotFoundError('No trace with this id was found')
    }

    return {
      traceId,
      store: this.traces.name,
      spans: spans.map((span) => ({ ...span, startedAt: span.startedAt.getTime() })),
      logs: found.entries.reverse().map((entry) => ({ ...entry, at: entry.at.getTime() })),
      isLogCut: found.total > found.entries.length
    }
  }

  private async traceOfRequest(requestId: string): Promise<string> {
    const { entries } = await this.logs.search({ requestId }, { limit: 1, offset: 0 })
    const traceId = entries[0]?.traceId

    if (!traceId) {
      throw new NotFoundError('No trace with this id was found')
    }

    return traceId
  }
}
