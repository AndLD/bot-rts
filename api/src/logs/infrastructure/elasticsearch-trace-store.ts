import { ITraceSpan, SpanStatusName } from '../../../../lib/utils/admin-logs'
import { Clock } from '../../shared/application/clock'
import { SpanRecord, TraceStore } from '../application/trace-store'
import { ElasticsearchClient } from './elasticsearch-client'

export interface ElasticsearchTraceSettings {
  // The data stream the gateway writes the spans to
  index: string
  // How far back a trace is looked for
  maxWindowDays: number
}

// A trace has at most this many spans in the view
export const MAX_SPANS = 1000
const DAY_MS = 24 * 60 * 60 * 1000
const NS_PER_MS = 1_000_000

interface SpanDocument {
  '@timestamp': string
  SpanId: string
  ParentSpanId?: string
  Name?: string
  Kind?: string
  Duration?: number
  TraceStatus?: number
  Resource?: { service?: { name?: string; instance?: { id?: string } } }
}

interface SearchResponse {
  hits: { hits: Array<{ _source: SpanDocument }> }
}

const KINDS: Record<string, ITraceSpan['kind']> = {
  SPAN_KIND_SERVER: 'server',
  SPAN_KIND_CLIENT: 'client',
  SPAN_KIND_PRODUCER: 'producer',
  SPAN_KIND_CONSUMER: 'consumer'
}

const STATUSES: Record<number, SpanStatusName> = { 1: 'ok', 2: 'error' }

// The spans of the nodes, read from the Elasticsearch the gateway writes to, with the same read-only account as the logs
export class ElasticsearchTraceStore implements TraceStore {
  readonly name = 'elasticsearch' as const

  constructor(
    private readonly settings: ElasticsearchTraceSettings,
    private readonly client: ElasticsearchClient,
    private readonly clock: Clock
  ) {}

  async spans(traceId: string): Promise<SpanRecord[]> {
    const since = new Date(this.clock.now().getTime() - this.settings.maxWindowDays * DAY_MS)
    const response = await this.client.search<SearchResponse>(this.settings.index, {
      query: {
        bool: {
          filter: [{ term: { TraceId: traceId } }, { range: { '@timestamp': { gte: since.toISOString() } } }]
        }
      },
      sort: [{ '@timestamp': 'asc' }],
      size: MAX_SPANS,
      _source: ['@timestamp', 'SpanId', 'ParentSpanId', 'Name', 'Kind', 'Duration', 'TraceStatus', 'Resource.service']
    })

    return (response?.hits.hits ?? []).map(({ _source }) => this.toSpan(_source))
  }

  private toSpan(source: SpanDocument): SpanRecord {
    return {
      spanId: source.SpanId,
      parentSpanId: source.ParentSpanId || null,
      name: source.Name ?? '',
      kind: KINDS[source.Kind ?? ''] ?? 'internal',
      service: source.Resource?.service?.name ?? null,
      node: source.Resource?.service?.instance?.id ?? null,
      startedAt: new Date(source['@timestamp']),
      durationMs: (source.Duration ?? 0) / NS_PER_MS,
      status: STATUSES[source.TraceStatus ?? 0] ?? 'unset'
    }
  }
}
