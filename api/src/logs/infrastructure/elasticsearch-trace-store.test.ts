import { fakeElasticsearch } from '../../../tests/fakes/elasticsearch'
import { FakeClock } from '../../../tests/fakes/fakes'
import { ElasticsearchTraceStore } from './elasticsearch-trace-store'

const TRACE = 'a'.repeat(32)

const SPAN = {
  '@timestamp': '2026-10-16T10:00:00.500Z',
  SpanId: 'b'.repeat(16),
  ParentSpanId: 'c'.repeat(16),
  Name: 'engine act',
  Kind: 'SPAN_KIND_SERVER',
  Duration: 2_500_000,
  TraceStatus: 2,
  Resource: { service: { name: 'botrts-engine', instance: { id: 'host:1' } } }
}

function setup(answer: Parameters<typeof fakeElasticsearch>[0]) {
  const { client, calls } = fakeElasticsearch(answer)

  return {
    calls,
    store: new ElasticsearchTraceStore({ index: 'botrts-traces', maxWindowDays: 7 }, client, new FakeClock())
  }
}

describe('ElasticsearchTraceStore', () => {
  it('asks for the spans of the trace in the widest window, oldest first, and maps them', async () => {
    const { store, calls } = setup({ body: { hits: { hits: [{ _source: SPAN }] } } })

    expect(await store.spans(TRACE)).toEqual([
      {
        spanId: 'b'.repeat(16),
        parentSpanId: 'c'.repeat(16),
        name: 'engine act',
        kind: 'server',
        service: 'botrts-engine',
        node: 'host:1',
        startedAt: new Date('2026-10-16T10:00:00.500Z'),
        durationMs: 2.5,
        status: 'error'
      }
    ])
    expect(calls[0].url).toBe('https://es.example:9200/botrts-traces/_search')
    expect(calls[0].body).toMatchObject({ sort: [{ '@timestamp': 'asc' }], size: 1000 })
    expect(calls[0].body.query.bool.filter[0]).toEqual({ term: { TraceId: TRACE } })
    expect(new Date(calls[0].body.query.bool.filter[1].range['@timestamp'].gte).getTime()).toBe(
      new FakeClock().now().getTime() - 7 * 24 * 3600 * 1000
    )
  })

  it('reads the kinds and the statuses of the spans, and spans that lack the optional fields', async () => {
    const { store } = setup({
      body: {
        hits: {
          hits: [
            { _source: { ...SPAN, Kind: 'SPAN_KIND_CLIENT', TraceStatus: 1 } },
            { _source: { ...SPAN, Kind: 'SPAN_KIND_PRODUCER', TraceStatus: 0 } },
            { _source: { ...SPAN, Kind: 'SPAN_KIND_CONSUMER' } },
            { _source: { '@timestamp': SPAN['@timestamp'], SpanId: 'd'.repeat(16) } }
          ]
        }
      }
    })

    const spans = await store.spans(TRACE)

    expect(spans.map((span) => [span.kind, span.status])).toEqual([
      ['client', 'ok'],
      ['producer', 'unset'],
      ['consumer', 'error'],
      ['internal', 'unset']
    ])
    expect(spans[3]).toMatchObject({ parentSpanId: null, name: '', service: null, node: null, durationMs: 0 })
  })

  it('has no spans when nothing was ever written', async () => {
    expect(await setup({ status: 404 }).store.spans(TRACE)).toEqual([])
  })
})
