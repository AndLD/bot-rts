import { LOG_LEVELS, LogLevelName } from '../../../../lib/utils/admin-logs'
import { Clock } from '../../shared/application/clock'
import { ValidationError } from '../../shared/domain/errors'
import { LogEntry, LogNodeInfo, LogPageRequest, LogQuery, LogSearchResult, LogStore } from '../application/log-store'
import { ElasticsearchClient } from './elasticsearch-client'

export interface ElasticsearchLogSettings {
  // The data stream the gateway writes the logs to
  index: string
  // The widest time range of one search, and the one used when the question names none
  maxWindowDays: number
  defaultWindowHours: number
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
// Elasticsearch refuses to page deeper than this (`index.max_result_window`)
export const MAX_RESULT_WINDOW = 10_000
const NODE_LIMIT = 100

interface Hit {
  _source: {
    '@timestamp': string
    message?: string
    log?: { level?: string }
    botrts?: { request_id?: string }
    trace?: { id?: string }
    service?: { name?: string; node?: { name?: string } }
  }
}

interface SearchResponse {
  hits: { total: { value: number }; hits: Hit[] }
  aggregations?: {
    nodes: { buckets: Array<{ key: string; services: { buckets: Array<{ key: string }> } }> }
  }
}

const SOURCE_FIELDS = [
  '@timestamp',
  'message',
  'log.level',
  'botrts.request_id',
  'trace.id',
  'service.name',
  'service.node.name'
]

const toLevel = (value: string | undefined): LogLevelName => {
  const level = (value ?? 'info').toLowerCase()

  return (LOG_LEVELS as readonly string[]).includes(level) ? (level as LogLevelName) : 'info'
}

// The log of every node, read from the Elasticsearch the gateway writes to (design §25.3). It asks with a read-only account, for a
// bounded time range and page, within a time limit, and says plainly when the store cannot answer.
export class ElasticsearchLogStore implements LogStore {
  readonly name = 'elasticsearch' as const

  constructor(
    private readonly settings: ElasticsearchLogSettings,
    private readonly client: ElasticsearchClient,
    private readonly clock: Clock
  ) {}

  async search(query: LogQuery, { limit, offset }: LogPageRequest): Promise<LogSearchResult> {
    if (offset + limit > MAX_RESULT_WINDOW) {
      throw new ValidationError(
        `A search cannot reach past the first ${MAX_RESULT_WINDOW} lines; narrow the time range`
      )
    }
    const response = await this.client.search<SearchResponse>(this.settings.index, {
      query: { bool: { filter: this.filters(query), must: this.phrases(query) } },
      sort: [{ '@timestamp': 'desc' }],
      from: offset,
      size: limit,
      track_total_hits: true,
      _source: SOURCE_FIELDS
    })

    return {
      entries: response ? response.hits.hits.map(({ _source }) => this.toEntry(_source)) : [],
      total: response?.hits.total.value ?? 0,
      capacity: null
    }
  }

  async nodes(): Promise<LogNodeInfo[]> {
    const to = this.clock.now()
    const response = await this.client.search<SearchResponse>(this.settings.index, {
      size: 0,
      query: { range: { '@timestamp': { gte: this.isoBefore(to, this.settings.maxWindowDays * DAY_MS) } } },
      aggs: {
        nodes: {
          terms: { field: 'service.node.name', size: NODE_LIMIT },
          aggs: { services: { terms: { field: 'service.name', size: 10 } } }
        }
      }
    })

    return (response?.aggregations?.nodes.buckets ?? []).map((bucket) => ({
      id: bucket.key,
      services: bucket.services.buckets.map((service) => service.key)
    }))
  }

  private filters(query: LogQuery): object[] {
    const { from, to } = this.window(query)
    const filters: object[] = [{ range: { '@timestamp': { gte: from.toISOString(), lte: to.toISOString() } } }]
    const exact: Array<[string, string | undefined]> = [
      ['log.level', query.level?.toUpperCase()],
      ['botrts.request_id', query.requestId],
      ['trace.id', query.traceId],
      ['service.node.name', query.node]
    ]
    for (const [field, value] of exact) {
      if (value !== undefined) {
        filters.push({ term: { [field]: value } })
      }
    }

    return filters
  }

  // Words and ids that the message must contain, as phrases (an id is several tokens to the analyzer)
  private phrases(query: LogQuery): object[] {
    return [query.text, query.userId, query.botId]
      .filter((value): value is string => value !== undefined)
      .map((value) => ({ match_phrase: { message: value } }))
  }

  private window(query: LogQuery): { from: Date; to: Date } {
    const to = query.to ?? this.clock.now()
    const from = query.from ?? new Date(to.getTime() - this.settings.defaultWindowHours * HOUR_MS)

    if (to.getTime() - from.getTime() > this.settings.maxWindowDays * DAY_MS) {
      throw new ValidationError(`The time range of a search is at most ${this.settings.maxWindowDays} days`)
    }

    return { from, to }
  }

  private isoBefore(date: Date, ms: number): string {
    return new Date(date.getTime() - ms).toISOString()
  }

  private toEntry(source: Hit['_source']): LogEntry {
    return {
      at: new Date(source['@timestamp']),
      level: toLevel(source.log?.level),
      message: source.message ?? '',
      requestId: source.botrts?.request_id ?? null,
      traceId: source.trace?.id ?? null,
      node: source.service?.node?.name ?? null,
      service: source.service?.name ?? null
    }
  }
}
