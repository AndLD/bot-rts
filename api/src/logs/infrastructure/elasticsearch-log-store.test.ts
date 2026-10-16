import { FakeClock } from '../../../tests/fakes/fakes'
import { ValidationError } from '../../shared/domain/errors'
import { LogStoreUnavailableError } from '../domain/log-store.errors'
import { ElasticsearchLogSettings, ElasticsearchLogStore, MAX_RESULT_WINDOW } from './elasticsearch-log-store'

const settings: ElasticsearchLogSettings = {
  url: 'https://es.example:9200/',
  index: 'botrts-logs',
  timeoutMs: 50,
  maxWindowDays: 7,
  defaultWindowHours: 24
}

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

type Answer = { status?: number; body?: unknown } | Error

function setup(
  answer: Answer | ((body: Record<string, unknown>) => Answer) = { body: { hits: { total: { value: 0 }, hits: [] } } },
  over: Partial<ElasticsearchLogSettings> = {}
) {
  const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, any> }> = []
  const fetchImpl = jest.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
    const body = JSON.parse(init.body)
    calls.push({ url, headers: init.headers, body })
    const result = typeof answer === 'function' ? answer(body) : answer
    if (result instanceof Error) throw result
    const status = result.status ?? 200

    return { ok: status < 300, status, json: async () => result.body }
  })
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const store = new ElasticsearchLogStore({ ...settings, ...over }, new FakeClock(), logger, fetchImpl as never)

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

  it('sends the API key, or the user and password, of the read-only account', async () => {
    const withKey = setup(undefined, { apiKey: 'abc' })
    const withUser = setup(undefined, { username: 'reader', password: 'secret' })
    const withUserOnly = setup(undefined, { username: 'reader' })
    const anonymous = setup()

    await Promise.all([withKey, withUser, withUserOnly, anonymous].map(({ store }) => store.search({}, page)))

    expect(withKey.calls[0].headers.authorization).toBe('ApiKey abc')
    expect(withUser.calls[0].headers.authorization).toBe(`Basic ${Buffer.from('reader:secret').toString('base64')}`)
    expect(withUserOnly.calls[0].headers.authorization).toBe(`Basic ${Buffer.from('reader:').toString('base64')}`)
    expect(anonymous.calls[0].headers.authorization).toBeUndefined()
  })

  it('says there are no lines when nothing was ever logged', async () => {
    const { store } = setup({ status: 404, body: { error: 'index_not_found_exception' } })

    expect(await store.search({}, page)).toEqual({ entries: [], total: 0, capacity: null })
  })

  it('reads a line that lacks the optional fields, and an unknown level as info', async () => {
    const { store } = setup({
      body: {
        hits: {
          total: { value: 1 },
          hits: [{ _source: { '@timestamp': '2026-10-16T10:00:00Z', log: { level: 'DEBUG' } } }]
        }
      }
    })

    expect((await store.search({}, page)).entries[0]).toMatchObject({
      level: 'info',
      message: '',
      requestId: null,
      traceId: null,
      node: null,
      service: null
    })
  })
})

describe('ElasticsearchLogStore when the store is down', () => {
  it('says so when Elasticsearch cannot be reached, refuses, or does not answer in time', async () => {
    const down = setup(new Error('ECONNREFUSED'))
    const refused = setup({ status: 503 })
    const slow = new ElasticsearchLogStore(
      { ...settings, timeoutMs: 10 },
      new FakeClock(),
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      ((_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(new Error('aborted')))
        )) as never
    )

    await expect(down.store.search({}, page)).rejects.toThrow(
      new LogStoreUnavailableError('The log store cannot be reached')
    )
    await expect(refused.store.nodes()).rejects.toThrow(
      new LogStoreUnavailableError('The log store refused the search (503)')
    )
    await expect(slow.search({}, page)).rejects.toThrow(
      new LogStoreUnavailableError('The log store did not answer in time')
    )
    expect(down.logger.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'))
    expect(refused.logger.warn).toHaveBeenCalledWith('The log store answered 503')
  })

  it('asks over the network by default', async () => {
    const real = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hits: { total: { value: 0 }, hits: [] } })
    } as Response)
    const store = new ElasticsearchLogStore(settings, new FakeClock(), {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    })

    await store.search({}, page)

    expect(real).toHaveBeenCalledTimes(1)
    real.mockRestore()
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
