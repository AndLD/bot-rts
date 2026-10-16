import { NotFoundError } from '../../shared/domain/errors'
import { MemoryTraceStore } from '../infrastructure/memory-trace-store'
import { LogEntry, LogPageRequest, LogQuery, LogSearchResult, LogStore } from './log-store'
import { SpanRecord, TraceStore } from './trace-store'
import { TracesService } from './traces.service'

const TRACE = 'a'.repeat(32)

const span = (overrides: Partial<SpanRecord> = {}): SpanRecord => ({
  spanId: 's1',
  parentSpanId: null,
  name: 'POST /x',
  kind: 'server',
  service: 'botrts-api',
  node: 'host:1',
  startedAt: new Date('2026-10-16T10:00:00.000Z'),
  durationMs: 40,
  status: 'ok',
  ...overrides
})

const entry = (seconds: number, overrides: Partial<LogEntry> = {}): LogEntry => ({
  at: new Date(Date.UTC(2026, 9, 16, 10, 0, seconds)),
  level: 'info',
  message: `line ${seconds}`,
  requestId: null,
  traceId: TRACE,
  node: 'host:1',
  service: 'botrts-api',
  ...overrides
})

function setup(spans: SpanRecord[], entries: LogEntry[], total = entries.length) {
  const traces: TraceStore = { name: 'elasticsearch', spans: jest.fn(async () => spans) }
  const logs: jest.Mocked<LogStore> = {
    name: 'elasticsearch',
    search: jest.fn<Promise<LogSearchResult>, [LogQuery, LogPageRequest]>(async () => ({
      entries: [...entries],
      total,
      capacity: null
    })),
    nodes: jest.fn()
  }

  return { service: new TracesService(traces, logs), traces, logs }
}

describe('TracesService', () => {
  it('returns the spans and every line of the trace, oldest first, looked for around the spans', async () => {
    const { service, logs } = setup(
      [span(), span({ spanId: 's2', parentSpanId: 's1', service: 'botrts-engine', node: 'host:2', durationMs: 10 })],
      [entry(2, { node: 'host:2' }), entry(1)]
    )

    const view = await service.read(TRACE)

    expect(view.traceId).toBe(TRACE)
    expect(view.store).toBe('elasticsearch')
    expect(view.spans.map((s) => [s.spanId, s.startedAt])).toEqual([
      ['s1', Date.UTC(2026, 9, 16, 10)],
      ['s2', Date.UTC(2026, 9, 16, 10)]
    ])
    expect(view.logs.map((line) => line.message)).toEqual(['line 1', 'line 2'])
    expect(view.isLogCut).toBe(false)
    expect(logs.search).toHaveBeenCalledWith(
      { traceId: TRACE, from: new Date('2026-10-16T09:59:00.000Z'), to: new Date('2026-10-16T10:01:00.040Z') },
      { limit: 500, offset: 0 }
    )
  })

  it('says when the trace has more lines than one answer holds', async () => {
    expect((await setup([span()], [entry(1)], 900).service.read(TRACE)).isLogCut).toBe(true)
  })

  it('shows only the lines when the store keeps no spans, or the trace was not sampled', async () => {
    const { logs } = setup([], [entry(1)])

    const view = await new TracesService(new MemoryTraceStore(), logs).read(TRACE)

    expect(view).toMatchObject({ store: 'memory', spans: [] })
    expect(view.logs).toHaveLength(1)
    expect(logs.search).toHaveBeenCalledWith({ traceId: TRACE }, { limit: 500, offset: 0 })
  })

  it('finds the trace of a request id from before trace ids, or says there is none', async () => {
    const found = setup([span()], [entry(1, { requestId: 'req-9' })])
    const view = await found.service.read('req-9')

    expect(view.traceId).toBe(TRACE)
    expect(found.logs.search).toHaveBeenNthCalledWith(1, { requestId: 'req-9' }, { limit: 1, offset: 0 })
    const unknown = setup([], [], 0)
    await expect(unknown.service.read('req-unknown')).rejects.toThrow(
      new NotFoundError('No trace with this id was found')
    )
    const noTrace = setup([], [entry(1, { requestId: 'old', traceId: null })])
    await expect(noTrace.service.read('old')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('says there is no such trace when there are neither spans nor lines', async () => {
    await expect(setup([], []).service.read(TRACE)).rejects.toBeInstanceOf(NotFoundError)
  })
})
