import { fakeElasticsearch } from '../../../tests/fakes/elasticsearch'
import { LogStoreUnavailableError } from '../domain/log-store.errors'
import { ElasticsearchClient } from './elasticsearch-client'

const BODY = { query: { match_all: {} } }

describe('ElasticsearchClient', () => {
  it('posts the search to the index and returns the answer', async () => {
    const { client, calls } = fakeElasticsearch({ body: { hits: 'found' } })

    expect(await client.search('botrts-logs', BODY)).toEqual({ hits: 'found' })
    expect(calls[0]).toMatchObject({ url: 'https://es.example:9200/botrts-logs/_search', body: BODY })
    expect(calls[0].headers['content-type']).toBe('application/json')
  })

  it('sends the API key, or the user and password, of the read-only account', async () => {
    const withKey = fakeElasticsearch(undefined, { apiKey: 'abc' })
    const withUser = fakeElasticsearch(undefined, { username: 'reader', password: 'secret' })
    const withUserOnly = fakeElasticsearch(undefined, { username: 'reader' })
    const anonymous = fakeElasticsearch()

    await Promise.all([withKey, withUser, withUserOnly, anonymous].map(({ client }) => client.search('i', BODY)))

    expect(withKey.calls[0].headers.authorization).toBe('ApiKey abc')
    expect(withUser.calls[0].headers.authorization).toBe(`Basic ${Buffer.from('reader:secret').toString('base64')}`)
    expect(withUserOnly.calls[0].headers.authorization).toBe(`Basic ${Buffer.from('reader:').toString('base64')}`)
    expect(anonymous.calls[0].headers.authorization).toBeUndefined()
  })

  it('says there is nothing when the data stream does not exist yet', async () => {
    const { client } = fakeElasticsearch({ status: 404, body: { error: 'index_not_found_exception' } })

    expect(await client.search('botrts-logs', BODY)).toBeNull()
  })

  it('says so when Elasticsearch cannot be reached, refuses, or does not answer in time', async () => {
    const down = fakeElasticsearch(new Error('ECONNREFUSED'))
    const refused = fakeElasticsearch({ status: 503 })
    const slow = new ElasticsearchClient(
      { url: 'http://es', timeoutMs: 10 },
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      ((_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () => reject(new Error('aborted')))
        )) as never
    )

    await expect(down.client.search('i', BODY)).rejects.toThrow(
      new LogStoreUnavailableError('The log store cannot be reached')
    )
    await expect(refused.client.search('i', BODY)).rejects.toThrow(
      new LogStoreUnavailableError('The log store refused the search (503)')
    )
    await expect(slow.search('i', BODY)).rejects.toThrow(
      new LogStoreUnavailableError('The log store did not answer in time')
    )
    expect(down.logger.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'))
    expect(refused.logger.warn).toHaveBeenCalledWith('The log store answered 503')
  })

  it('asks over the network by default', async () => {
    const real = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    } as Response)
    const client = new ElasticsearchClient(
      { url: 'http://es', timeoutMs: 50 },
      {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    )

    await client.search('i', BODY)

    expect(real).toHaveBeenCalledTimes(1)
    real.mockRestore()
  })
})
