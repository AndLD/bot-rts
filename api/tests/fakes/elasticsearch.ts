import { ElasticsearchClient, ElasticsearchSettings } from '../../src/logs/infrastructure/elasticsearch-client'

export type EsAnswer = { status?: number; body?: unknown } | Error

export interface EsCall {
  url: string
  headers: Record<string, string>
  body: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

// An Elasticsearch client over a fake `fetch`: records each search and answers with what the test says
export function fakeElasticsearch(
  answer: EsAnswer | ((body: Record<string, unknown>) => EsAnswer) = {
    body: { hits: { total: { value: 0 }, hits: [] } }
  },
  settings: Partial<ElasticsearchSettings> = {}
) {
  const calls: EsCall[] = []
  const fetchImpl = jest.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
    const body = JSON.parse(init.body)
    calls.push({ url, headers: init.headers, body })
    const result = typeof answer === 'function' ? answer(body) : answer
    if (result instanceof Error) throw result
    const status = result.status ?? 200

    return { ok: status < 300, status, json: async () => result.body }
  })
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  const client = new ElasticsearchClient(
    { url: 'https://es.example:9200/', timeoutMs: 50, ...settings },
    logger,
    fetchImpl as never
  )

  return { client, calls, logger }
}
