import { fakeElasticsearch } from '../../../tests/fakes/elasticsearch'
import { FakeClock } from '../../../tests/fakes/fakes'
import { ValidationError } from '../../shared/domain/errors'
import { ElasticsearchLogSettings, ElasticsearchLogStore, MAX_RESULT_WINDOW } from './elasticsearch-log-store'

const settings: ElasticsearchLogSettings = { index: 'botrts-logs', maxWindowDays: 7, defaultWindowHours: 24 }

const HIT = {
  _source: {
    '@timestamp': '2026-10-16T10:00:00.000Z',
    message: 'GET /x 200 3.0ms',
    log: { level: 'WARN' },
    botrts: { request_id: 'req-1' },
    trace: { id: 'a'.repeat(32) },
    service: { name: 'botrts-api', node: { name: 'host:1' } }
  }
}

function setup(
  answer: Parameters<typeof fakeElasticsearch>[0] = undefined,
  over: Partial<ElasticsearchLogSettings> = {}
) {
  const { client, calls, logger } = fakeElasticsearch(answer)
  const store = new ElasticsearchLogStore({ ...settings, ...over }, client, new FakeClock())

  return { store, calls, logger, clock: new FakeClock() }
}

const page = { limit: 50, offset: 0 }

describe('ElasticsearchLogStore search', () => {
  it('asks for the newest lines of the last day, newest first, and maps the hits', async () => {
    const { store, calls, clock } = setup({ body: { hits: { total: { value: 41 }, hits: [HIT] } } })

    const result = await store.search({}, { limit: 50, offset: 10 })

    expect(result).toEqual({
      entries: [
        {
          at: new Date('2026-10-16T10:00:00.000Z'),
          level: 'warn',
          message: 'GET /x 200 3.0ms',
          requestId: 'req-1',
          traceId: 'a'.repeat(32),
          node: 'host:1',
          service: 'botrts-api'
        }
      ],
      total: 41,
      capacity: null
    })
    expect(calls[0].url).toBe('https://es.example:9200/botrts-logs/_search')
    expect(calls[0].body).toMatchObject({
      from: 10,
      size: 50,
      sort: [{ '@timestamp': 'desc' }],
      track_total_hits: true
    })
    const range = calls[0].body.query.bool.filter[0].range['@timestamp']
    expect(new Date(range.lte).getTime()).toBe(clock.now().getTime())
    expect(new Date(range.lte).getTime() - new Date(range.gte).getTime()).toBe(24 * 3600 * 1000)
  })

  it('turns every filter into a term or a phrase', async () => {
    const { store, calls } = setup()
    const from = new Date('2026-10-15T00:00:00Z')
    const to = new Date('2026-10-16T00:00:00Z')

    await store.search(
      {
        text: 'slow query',
        level: 'error',
        requestId: 'r1',
        traceId: 't1',
        userId: 'u1',
        botId: 'b1',
        node: 'host:1',
        from,
        to
      },
      page
    )

    const { filter, must } = calls[0].body.query.bool
    expect(filter).toEqual([
      { range: { '@timestamp': { gte: from.toISOString(), lte: to.toISOString() } } },
      { term: { 'log.level': 'ERROR' } },
      { term: { 'botrts.request_id': 'r1' } },
      { term: { 'trace.id': 't1' } },
      { term: { 'service.node.name': 'host:1' } }
    ])
    expect(must).toEqual([
      { match_phrase: { message: 'slow query' } },
      { match_phrase: { message: 'u1' } },
      { match_phrase: { message: 'b1' } }
    ])
  })

  it('refuses a time range wider than the limit and a page past the window of Elasticsearch', async () => {
    const { store, calls } = setup()

    await expect(
      store.search({ from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-10-01T00:00:00Z') }, page)
    ).rejects.toThrow(new ValidationError('The time range of a search is at most 7 days'))
    await expect(store.search({}, { limit: 500, offset: MAX_RESULT_WINDOW - 499 })).rejects.toBeInstanceOf(
      ValidationError
    )
    expect(calls).toHaveLength(0)
  })

  it('says there are no lines when nothing was ever logged', async () => {
    const { store } = setup({ status: 404, body: { error: 'index_not_found_exception' } })

    expect(await store.search({}, page)).toEqual({ entries: [], total: 0, capacity: null })
  })

  it('reads a line that lacks the optional fields, and an unknown level as info', async () => {
    const { store } = setup({
      body: {
        hits: {
          total: { value: 2 },
          hits: [
            { _source: { '@timestamp': '2026-10-16T10:00:00Z', log: { level: 'DEBUG' } } },
            { _source: { '@timestamp': '2026-10-16T10:00:01Z' } }
          ]
        }
      }
    })

    const { entries } = await store.search({}, page)
    expect(entries.map((entry) => entry.level)).toEqual(['info', 'info'])
    expect(entries[0]).toMatchObject({
      level: 'info',
      message: '',
      requestId: null,
      traceId: null,
      node: null,
      service: null
    })
  })
})

describe('ElasticsearchLogStore nodes', () => {
  it('lists the processes that logged in the widest window, with their services', async () => {
    const { store, calls } = setup({
      body: {
        aggregations: {
          nodes: {
            buckets: [
              { key: 'host:1', services: { buckets: [{ key: 'botrts-api' }, { key: 'botrts-engine' }] } },
              { key: 'host:2', services: { buckets: [{ key: 'botrts-api' }] } }
            ]
          }
        }
      }
    })

    expect(await store.nodes()).toEqual([
      { id: 'host:1', services: ['botrts-api', 'botrts-engine'] },
      { id: 'host:2', services: ['botrts-api'] }
    ])
    expect(calls[0].body.size).toBe(0)
  })

  it('lists none when there is no data stream yet or no answer carries buckets', async () => {
    expect(await setup({ status: 404 }).store.nodes()).toEqual([])
    expect(await setup({ body: {} }).store.nodes()).toEqual([])
  })
})
